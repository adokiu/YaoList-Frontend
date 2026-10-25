import type { UploadBatchContext } from './types'

/**
 * 上传进度上报器。
 *
 * 统一进度口径（由后端合并，前端只上报原始字节数）：
 * - sent_bytes  浏览器 → YaoList 已发送字节数
 * - stored_bytes YaoList → 目标存储 已确认写入字节数
 *
 * 0% = 尚未开始从浏览器上传；100% 由 /api/fs/upload/complete_file 写入。
 * 运行中最多 99%，因此前端绝不上报“100%”，避免在存储确认前提前完成。
 *
 * 每 1 秒上报一次，进度条不会按分片大小跳变。
 */
export type UploadMode = 'proxy' | 'direct'

const FLUSH_INTERVAL_MS = 1000

type ProgressPayload = {
  task_id: string
  file_path: string
  mode: UploadMode
  sent_bytes: number
  stored_bytes: number
}

export class UploadProgressReporter {
  private readonly batch?: UploadBatchContext
  private readonly fileSize: number
  private mode: UploadMode
  private sent = 0
  private stored = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastFlushAt = 0
  private sending = false
  private pending = false
  private closed = false

  constructor(
    batch: UploadBatchContext | undefined,
    fileSize: number,
    mode: UploadMode = 'proxy',
  ) {
    this.batch = batch
    this.fileSize = Math.max(0, Number(fileSize) || 0)
    this.mode = mode
    if (this.batch) this.schedule()
  }

  setMode(mode: UploadMode) {
    if (this.mode !== mode) {
      this.mode = mode
      this.schedule()
    }
  }

  /** 浏览器已发送到后端的字节数（单调递增）。 */
  setSent(bytes: number) {
    const value = Math.min(this.fileSize, Math.max(0, Math.floor(bytes)))
    if (value > this.sent) {
      this.sent = value
      this.schedule()
    }
  }

  /** 后端已确认写入目标存储的字节数（单调递增）。 */
  setStored(bytes: number) {
    const value = Math.min(this.fileSize, Math.max(0, Math.floor(bytes)))
    if (value > this.stored) {
      this.stored = value
      this.schedule()
    }
  }

  private schedule() {
    if (this.closed || !this.batch || this.timer) return
    const wait = Math.max(0, FLUSH_INTERVAL_MS - (Date.now() - this.lastFlushAt))
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, wait)
  }

  private async flush() {
    if (this.closed || !this.batch) return
    if (this.sending) {
      this.pending = true
      return
    }

    const payload: ProgressPayload = {
      task_id: this.batch.taskId,
      file_path: this.batch.filePath,
      mode: this.mode,
      sent_bytes: this.sent,
      stored_bytes: this.stored,
    }

    this.sending = true
    this.lastFlushAt = Date.now()
    try {
      // fetch + keepalive：页面关闭/切换时也能送达最后一次进度。
      await fetch('/api/fs/upload/progress', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // 进度上报失败不应中断上传本身。
    } finally {
      this.sending = false
      if (this.pending) {
        this.pending = false
        this.schedule()
      } else {
        this.schedule()
      }
    }
  }

  /** 上传已确认写入存储：补满 sent/stored 并发送最后一次上报。 */
  async complete() {
    if (!this.batch) return
    this.sent = this.fileSize
    this.stored = this.fileSize
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // 若正好有一次 1Hz 上报在途，等它结束后再发最终值，避免最后一次被吞掉。
    const deadline = Date.now() + 2000
    while (this.sending && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    await this.flush()
    this.closed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** 放弃上报（失败/回退到其他上传方式时使用）。 */
  dispose() {
    this.closed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
