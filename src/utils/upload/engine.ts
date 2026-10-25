import { api } from '../api'
import { tryBrowserDirectUpload } from './direct'
import { UploadProgressReporter } from './progress'
import type { UploadOpts } from './types'

const DEFAULT_CHUNK_MB = 10

let uploadSettings: { multipartEnabled: boolean; chunkMb: number } | null = null

export async function loadUploadSettings() {
  if (uploadSettings) return uploadSettings
  try {
    const { data } = await api.get<{
      multipart_enabled?: boolean
      multipart_chunk_size?: number
    }>('/api/settings/public')
    uploadSettings = {
      multipartEnabled: data.multipart_enabled !== false,
      chunkMb: Math.max(1, Number(data.multipart_chunk_size) || DEFAULT_CHUNK_MB),
    }
  } catch {
    uploadSettings = { multipartEnabled: true, chunkMb: DEFAULT_CHUNK_MB }
  }
  return uploadSettings
}

const INFLIGHT = 3
const MAX_FLOW_RETRIES = 400

type MultipartState =
  | 'receiving'
  | 'completed'
  | 'failed_retriable'
  | 'failed_permanent'
  | 'aborted'

interface MultipartSnapshot {
  upload_id: string
  state: MultipartState
  attempt: number
  path: string
  size: number
  chunk_size: number
  total_chunks: number
  received: [number, number][]
  received_bytes: number
  frontier: number
  storage_progress: number
  error?: string
}

type SnapResp = { code: number; message?: string; data?: MultipartSnapshot | null }
type InitResp = { code: number; message?: string; data?: (MultipartSnapshot & { resumed?: boolean }) | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function chunkSizeBytes(chunkMb?: number): number {
  const mb = chunkMb ?? uploadSettings?.chunkMb ?? DEFAULT_CHUNK_MB
  return Math.max(1, mb) * 1024 * 1024
}

export function joinFsPath(targetPath: string, relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, '')
  const base = targetPath === '/' ? '' : targetPath.replace(/\/+$/, '')
  if (!base) return `/${rel}`
  return `${base}/${rel}`
}

async function mpRequest<T extends SnapResp | InitResp>(
  run: () => Promise<{ data: T }>,
): Promise<T | undefined> {
  try {
    const { data } = await run()
    if (data && typeof data.code === 'number' && 'data' in data) {
      return data
    }
    return undefined
  } catch (e: unknown) {
    const err = e as { response?: { data?: T } }
    const body = err.response?.data
    if (body && typeof body.code === 'number' && 'data' in body) {
      return body
    }
    if (body && (body as { code?: number }).code === -1) {
      throw new Error((body as { message?: string }).message || 'canceled')
    }
    return undefined
  }
}

export async function streamUpload(
  file: File,
  uploadPath: string,
  opts?: UploadOpts,
): Promise<void> {
  const overwrite = opts?.overwrite !== false
  const reporter = new UploadProgressReporter(opts?.batch, file.size, 'proxy')

  try {
    const resp = await api.put<{ code: number; message?: string }>(
      '/api/fs/put',
      file,
      {
        headers: {
          'File-Path': encodeURIComponent(uploadPath),
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Size': String(file.size),
          'Last-Modified': String(file.lastModified),
          Overwrite: String(overwrite),
          ...(opts?.pathPassword
            ? { 'X-Path-Password': encodeURIComponent(opts.pathPassword) }
            : {}),
          ...(opts?.batch
            ? {
                'X-Upload-Task-Id': opts.batch.taskId,
                'X-Upload-File-Path': opts.batch.filePath,
              }
            : {}),
        },
        onUploadProgress: (ev) => {
          // 只上报浏览器 → 后端字节；存储写入进度由后端驱动回调上报。
          reporter.setSent(ev.loaded)
        },
      },
    )

    if (resp.data.code !== 200) {
      throw new Error(resp.data.message || 'upload failed')
    }
    // PUT 成功返回时，后端已完成 writer.shutdown()，即文件已写入目标存储。
    reporter.setStored(file.size)
    await reporter.complete()
  } catch (err) {
    reporter.dispose()
    throw err
  }
}

async function multipartUpload(
  uploadPath: string,
  file: File,
  opts?: UploadOpts,
): Promise<void> {
  const reporter = new UploadProgressReporter(opts?.batch, file.size, 'proxy')
  try {
    const threshold = chunkSizeBytes()
    const initHeaders: Record<string, string> = {
      'File-Path': encodeURIComponent(uploadPath),
      'X-File-Size': String(file.size),
      'X-Chunk-Size': String(threshold),
      'Content-Type': file.type || 'application/octet-stream',
      'Last-Modified': String(file.lastModified),
      Overwrite: String(opts?.overwrite !== false),
      ...(opts?.pathPassword
        ? { 'X-Path-Password': encodeURIComponent(opts.pathPassword) }
        : {}),
      ...(opts?.batch
        ? {
            'X-Upload-Task-Id': opts.batch.taskId,
            'X-Upload-File-Path': opts.batch.filePath,
          }
        : {}),
    }

    let initResp: InitResp | undefined
    for (let i = 0; ; i++) {
      initResp = await mpRequest<InitResp>(() =>
        api.post('/api/fs/multipart/init', undefined, { headers: initHeaders }),
      )
      if (initResp) break
      if (i >= 2) throw new Error('multipart init failed: network error')
      await sleep(1000 * (i + 1))
    }
    if (initResp!.code !== 200) {
      throw new Error(initResp!.message || 'multipart init failed')
    }

    const session = initResp!.data
    if (!session) {
      reporter.dispose()
      return streamUpload(file, uploadPath, opts)
    }

    const uploadId = session.upload_id
    const chunkSize = session.chunk_size
    const total = session.total_chunks
    const chunkLen = (idx: number) =>
      idx === total - 1 ? file.size - idx * chunkSize : chunkSize

    if (session.state === 'completed') {
      reporter.setSent(file.size)
      reporter.setStored(file.size)
      await reporter.complete()
      return
    }

    const have = new Set<number>()
    for (const [lo, hi] of session.received ?? []) {
      for (let i = lo; i <= hi; i++) have.add(i)
    }
    const missing: number[] = []
    for (let i = 0; i < total; i++) {
      if (!have.has(i)) missing.push(i)
    }

    let ackedBytes = session.received_bytes ?? 0
    const inflightLoaded: Record<number, number> = {}

    const inflightBytes = () =>
      Object.values(inflightLoaded).reduce((sum, n) => sum + n, 0)
    const reportSent = () => {
      reporter.setSent(Math.min(file.size, ackedBytes + inflightBytes()))
    }

    reporter.setSent(ackedBytes)
    if (session.storage_progress) {
      reporter.setStored((session.storage_progress / 100) * file.size)
    }

    let completedEarly = false
    let fatal: Error | undefined

    const sendChunk = async (idx: number) => {
      const blob = file.slice(idx * chunkSize, idx * chunkSize + chunkLen(idx))
      let flowRetries = 0
      for (;;) {
        if (completedEarly || fatal) return

        const resp = await mpRequest<SnapResp>(() =>
          api.put('/api/fs/multipart/chunk', blob, {
            headers: {
              'X-Upload-Id': uploadId,
              'X-Chunk-Index': String(idx),
              'Content-Type': 'application/octet-stream',
            },
            onUploadProgress: (ev) => {
              // 分片内部也持续上报，进度不再按 10/16MB 一跳。
              inflightLoaded[idx] = Math.min(ev.loaded, chunkLen(idx))
              reportSent()
            },
          }),
        )
        delete inflightLoaded[idx]

        if (resp && resp.code === 200) {
          ackedBytes += chunkLen(idx)
          reportSent()
          if (resp.data?.state === 'completed') completedEarly = true
          return
        }
        if (resp && resp.code !== 429 && resp.code !== 409) {
          throw new Error(resp.message || `chunk ${idx} failed`)
        }
        if (!resp) {
          const st = await mpRequest<SnapResp>(() =>
            api.get(`/api/fs/multipart/status?upload_id=${encodeURIComponent(uploadId)}`),
          )
          if (
            (st?.code === 200 && st.data?.state === 'completed') ||
            st?.code === 404
          ) {
            completedEarly = true
            return
          }
          if (st?.code === 200 && st.data?.state.startsWith('failed')) {
            throw new Error(st.data.error || `upload failed (${st.data.state})`)
          }
        }
        flowRetries++
        if (flowRetries > MAX_FLOW_RETRIES) {
          throw new Error(`chunk ${idx} stalled: storage cannot keep up`)
        }
        await sleep(resp ? 800 : Math.min(1200 * flowRetries, 4800))
      }
    }

    let startFrom = 0
    if (session.state === 'failed_retriable' && missing.length > 0) {
      await sendChunk(missing[0])
      startFrom = 1
    }

    let nextIdx = startFrom
    const worker = async () => {
      for (;;) {
        if (completedEarly || fatal) return
        const i = nextIdx++
        if (i >= missing.length) return
        try {
          await sendChunk(missing[i])
        } catch (e: unknown) {
          fatal = e instanceof Error ? e : new Error(String(e))
          return
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(INFLIGHT, missing.length) || 1 }, () => worker()),
    )
    if (fatal) throw fatal

    if (completedEarly) {
      reporter.setSent(file.size)
      reporter.setStored(file.size)
      await reporter.complete()
      return
    }

    let settled = false
    const completePromise = mpRequest<SnapResp>(() =>
      api.post('/api/fs/multipart/complete', undefined, {
        headers: { 'X-Upload-Id': uploadId },
      }),
    )
      .catch(() => undefined)
      .finally(() => {
        settled = true
      })

    while (!settled) {
      await sleep(2000)
    }

    const fin = await completePromise
    if (fin) {
      if (fin.code !== 200) throw new Error(fin.message || 'multipart complete failed')
      // complete 返回时后端已完成存储写入。
      reporter.setStored(file.size)
      await reporter.complete()
      return
    }

    for (;;) {
      await sleep(2000)
      const st = await mpRequest<SnapResp>(() =>
        api.get(`/api/fs/multipart/status?upload_id=${encodeURIComponent(uploadId)}`),
      )
      if (!st) continue
      if (st.code === 404) {
        reporter.setStored(file.size)
        await reporter.complete()
        return
      }
      if (st.code !== 200) throw new Error(st.message || 'status failed')
      switch (st.data?.state) {
        case 'completed':
          reporter.setStored(file.size)
          await reporter.complete()
          return
        case 'receiving':
          continue
        default:
          throw new Error(st.data?.error || `upload failed (${st.data?.state})`)
      }
    }
  } catch (err) {
    reporter.dispose()
    throw err
  }
}

export async function uploadFileOpenList(
  file: File,
  uploadPath: string,
  options?: UploadOpts,
): Promise<void> {
  if (await tryBrowserDirectUpload(file, uploadPath, options)) {
    return
  }

  const settings = await loadUploadSettings()
  const threshold = chunkSizeBytes(settings.chunkMb)
  const useMultipart = options?.multipartEnabled ?? settings.multipartEnabled

  if (!useMultipart || file.size <= threshold) {
    return streamUpload(file, uploadPath, options)
  }
  return multipartUpload(uploadPath, file, options)
}

export const putStream = streamUpload
