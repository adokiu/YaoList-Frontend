function bytesToHexUpper(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let hex = ''
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

/** 139 直传 / 秒传所需 SHA256（大写 hex），流式读文件；哈希用 Web Crypto */
export async function sha256HexUpper(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const reader = file.stream().getReader()
  const parts: Uint8Array[] = []
  let loaded = 0
  const total = file.size

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    loaded += value.byteLength
    if (onProgress && total > 0) {
      onProgress(Math.min(99, Math.floor((loaded / total) * 100)))
    }
  }

  const all = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of parts) {
    all.set(chunk, offset)
    offset += chunk.byteLength
  }

  const digest = await crypto.subtle.digest('SHA-256', all)
  onProgress?.(100)
  return bytesToHexUpper(digest)
}
