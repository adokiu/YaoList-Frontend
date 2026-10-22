import { api } from '../api'
import { sha256HexUpper } from '../fileSha256'
import { reportBatchStorage } from './progress'
import type { DirectUploadInfo, UploadOpts } from './types'

async function putPartWithProgress(
  url: string,
  blob: Blob,
  onLoaded: (n: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`part upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('part upload network error'))
    xhr.send(blob)
  })
}

async function directUploadWithTool(
  file: File,
  uploadPath: string,
  tool: string,
  opts?: UploadOpts,
): Promise<boolean> {
  const dir = uploadPath.replace(/\/[^/]+$/, '') || '/'
  const fileName = uploadPath.split('/').pop() || file.name

  reportBatchStorage(opts?.batch, 0, 'uploading', file.size)
  const hash = await sha256HexUpper(file, (p) => {
    reportBatchStorage(opts?.batch, p * 0.05, 'uploading', file.size)
  })

  const init = await api.post<{ code: number; data?: DirectUploadInfo | null }>(
    '/api/fs/get_direct_upload_info',
    {
      path: dir,
      file_name: fileName,
      file_size: file.size,
      content_type: file.type || 'application/octet-stream',
      tool,
      content_hash: hash,
    },
  )
  const info = init.data?.data
  if (!info?.parts && !info?.exist && !info?.rapid_upload) {
    return false
  }
  if (info.exist || info.rapid_upload || !info.parts?.length) {
    reportBatchStorage(opts?.batch, 100, 'uploading', file.size)
    return true
  }

  const partSize = info.part_size
  const totalParts = info.parts.length
  let doneParts = 0
  const inflight: Record<number, number> = {}

  const reportParts = () => {
    let extra = 0
    for (const v of Object.values(inflight)) extra += v
    const partBytes = info.parts.reduce((s, p) => s + p.size, 0)
    const base = doneParts / totalParts
    const frac = partBytes > 0 ? extra / partBytes : 0
    const pct = Math.min(99, Math.floor((base + frac / totalParts) * 100))
    reportBatchStorage(opts?.batch, pct, 'uploading', file.size)
  }

  for (const part of info.parts) {
    const idx = part.part_number - 1
    const start = idx * partSize
    const blob = file.slice(start, start + part.size)
    await putPartWithProgress(part.upload_url, blob, (loaded) => {
      inflight[part.part_number] = loaded
      reportParts()
    })
    delete inflight[part.part_number]
    doneParts++
    reportBatchStorage(
      opts?.batch,
      Math.min(99, Math.floor((doneParts / totalParts) * 100)),
      'uploading',
      file.size,
    )
  }

  reportBatchStorage(opts?.batch, 99, 'backending', file.size)
  await api.post('/api/fs/direct_upload/complete', {
    tool: info.tool || tool,
    mount_id: info.mount_id,
    file_id: info.file_id,
    upload_id: info.upload_id,
    content_hash: hash,
  })
  reportBatchStorage(opts?.batch, 100, 'uploading', file.size)
  return true
}

/** 按 list 返回的工具链尝试浏览器直传；全部不可用则 false */
export async function tryBrowserDirectUpload(
  file: File,
  uploadPath: string,
  opts?: UploadOpts,
): Promise<boolean> {
  const tools = opts?.directUploadTools?.filter(Boolean) ?? []
  if (!tools.length) return false

  for (const tool of tools) {
    try {
      if (await directUploadWithTool(file, uploadPath, tool, opts)) {
        return true
      }
    } catch (e) {
      console.warn(`direct upload (${tool}) failed`, e)
    }
  }
  return false
}
