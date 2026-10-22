import { api } from '../api'
import type { UploadBatchContext } from './types'

/** 任务栏/SSE：只上报写入存储进度（OpenList storage_progress 0–100） */
export function reportBatchStorage(
  batch: UploadBatchContext | undefined,
  storagePercent: number,
  phase: 'uploading' | 'backending',
  totalBytes: number,
) {
  const pct = Math.min(100, Math.max(0, storagePercent))
  batch?.onProgress?.(Math.floor((pct / 100) * totalBytes), totalBytes, phase)
  if (!batch) return
  void api.post('/api/fs/upload/progress', {
    task_id: batch.taskId,
    file_path: batch.filePath,
    uploaded_size: 0,
    phase,
    storage_percent: pct,
  })
}
