/** 解析 CSS 长度（px / rem）为像素，供 List 列宽分配 */
export function parseCssLengthToPx(value: string): number {
  const trimmed = value.trim()
  const match = trimmed.match(/^([\d.]+)\s*(px|rem)?$/i)
  if (!match) return 0
  const num = Number(match[1])
  if (!Number.isFinite(num)) return 0
  if (match[2]?.toLowerCase() === 'rem') return num * 16
  return num
}

/** 从 grid track（含 minmax）取最小占位宽度 */
export function minWidthFromColumnTrack(track: string): number {
  const trimmed = track.trim()
  const minmax = trimmed.match(/minmax\(\s*([^,\s]+)/i)
  if (minmax) return parseCssLengthToPx(minmax[1]!)
  const parsed = parseCssLengthToPx(trimmed)
  return parsed > 0 ? parsed : 72
}

const COLUMN_WIDTH_ALIASES: Record<string, string[]> = {
  online: ['online', 'status'],
  public_host: ['public_host', 'ip'],
  public_ip: ['public_ip', 'ip'],
  memory: ['memory', 'mem'],
  traffic_speed: ['traffic_speed', 'rate'],
  bandwidth: ['bandwidth', 'traffic'],
}

export function resolveListColumnTrack(
  columnKey: string,
  widths: Record<string, string>,
): string | undefined {
  const keys = COLUMN_WIDTH_ALIASES[columnKey] ?? [columnKey]
  for (const key of keys) {
    const track = widths[key]?.trim()
    if (track) return track
  }
  return undefined
}

export function columnWeightFromListSettings(
  columnKey: string,
  widths: Record<string, string>,
  fallback: number,
): number {
  const track = resolveListColumnTrack(columnKey, widths)
  if (track) {
    const px = minWidthFromColumnTrack(track)
    if (px > 0) return px
  }
  return fallback > 0 ? fallback : 72
}
