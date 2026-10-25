import { api } from '../api'
import { sha256HexUpper } from '../fileSha256'
import { UploadProgressReporter } from './progress'
import type { DirectUploadInfo, UploadOpts } from './types'

function getPathPassword(targetPath: string): string {
  try {
    const passwords = JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
    if (passwords[targetPath]) return passwords[targetPath]
    const parts = targetPath.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const parent = '/' + parts.slice(0, i).join('/')
      const normalized = parent === '' ? '/' : parent
      if (passwords[normalized]) return passwords[normalized]
    }
    if (passwords['/']) return passwords['/']
  } catch {}
  return ''
}

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

  // 哈希/初始化属于准备阶段，暂不上报，避免直传失败回退代理时污染进度。
  const hash = await sha256HexUpper(file)

  const init = await api.post<{ code: number; data?: DirectUploadInfo | null }>(
    '/api/fs/get_direct_upload_info',
    {
      path: dir,
      file_name: fileName,
      file_size: file.size,
      content_type: file.type || 'application/octet-stream',
      tool,
      content_hash: hash,
      path_password: getPathPassword(uploadPath) || undefined,
    },
  )
  const info = init.data?.data
  if (!info?.parts && !info?.exist && !info?.rapid_upload) {
    return false
  }

  const reporter = new UploadProgressReporter(opts?.batch, file.size, 'direct')
  try {
    // 直传只统计已写入目标存储的字节；哈希/初始化阶段保持 0%。
    if (info.exist || info.rapid_upload || !info.parts?.length) {
      reporter.setStored(file.size)
      await reporter.complete()
      return true
    }

    const partSize = info.part_size
    let doneBytes = 0
    const inflight: Record<number, number> = {}

    const reportStored = () => {
      let extra = 0
      for (const v of Object.values(inflight)) extra += v
      reporter.setStored(Math.min(file.size, doneBytes + extra))
    }

    for (const part of info.parts) {
      const idx = part.part_number - 1
      const start = idx * partSize
      const blob = file.slice(start, start + part.size)
      await putPartWithProgress(part.upload_url, blob, (loaded) => {
        inflight[part.part_number] = Math.min(loaded, part.size)
        reportStored()
      })
      delete inflight[part.part_number]
      doneBytes += part.size
      reporter.setStored(doneBytes)
    }

    // complete 接口确认后，文件才真正落到目标存储。
    await api.post('/api/fs/direct_upload/complete', {
      tool: info.tool || tool,
      mount_id: info.mount_id,
      file_id: info.file_id,
      upload_id: info.upload_id,
      content_hash: hash,
    })
    reporter.setStored(file.size)
    await reporter.complete()
    return true
  } catch (err) {
    reporter.dispose()
    throw err
  }
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
