export type UploadBatchContext = {
  taskId: string
  filePath: string
  onProgress?: (uploaded: number, total: number, phase?: 'uploading' | 'backending') => void
}

/** 与 list API `direct_upload_tools` 对齐；有则优先浏览器直传 */
export type UploadOpts = {
  overwrite?: boolean
  batch?: UploadBatchContext
  multipartEnabled?: boolean
  directUploadTools?: string[]
}

export type DirectUploadInfo = {
  tool: string
  mount_id: string
  file_id: string
  upload_id: string
  part_size: number
  parts: { part_number: number; upload_url: string; size: number }[]
  exist?: boolean
  rapid_upload?: boolean
}
