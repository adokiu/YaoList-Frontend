export const VIEWPORT_EDGE_PADDING = 8

export type AnchorAlign = 'start' | 'end' | 'center'

export function clampBoxInViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  padding = VIEWPORT_EDGE_PADDING
): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxX = Math.max(padding, vw - width - padding)
  const maxY = Math.max(padding, vh - height - padding)
  return {
    x: Math.min(Math.max(x, padding), maxX),
    y: Math.min(Math.max(y, padding), maxY),
  }
}

/** 右键 / 指针菜单：优先右下展开，空间不足时向左上翻转 */
export function pointerMenuPosition(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  padding = VIEWPORT_EDGE_PADDING
): { x: number; y: number } {
  let x = clientX
  let y = clientY
  if (x + width + padding > window.innerWidth) {
    x = clientX - width
  }
  if (y + height + padding > window.innerHeight) {
    y = clientY - height
  }
  return clampBoxInViewport(x, y, width, height, padding)
}

/** 锚点下拉：自动选择上/下，水平对齐并 clamp 到视口 */
export function anchorMenuPosition(
  anchor: DOMRect,
  width: number,
  height: number,
  options?: {
    gap?: number
    align?: AnchorAlign
    padding?: number
  }
): { x: number; y: number } {
  const gap = options?.gap ?? 4
  const align = options?.align ?? 'start'
  const padding = options?.padding ?? VIEWPORT_EDGE_PADDING

  const spaceBelow = window.innerHeight - anchor.bottom - gap - padding
  const spaceAbove = anchor.top - gap - padding
  const openBelow = height <= spaceBelow || spaceBelow >= spaceAbove

  const y = openBelow ? anchor.bottom + gap : anchor.top - height - gap

  let x: number
  if (align === 'end') x = anchor.right - width
  else if (align === 'center') x = anchor.left + anchor.width / 2 - width / 2
  else x = anchor.left

  return clampBoxInViewport(x, y, width, height, padding)
}

export function clampVerticalPosition(
  preferredTop: number,
  height: number,
  padding = VIEWPORT_EDGE_PADDING
): number {
  const maxY = Math.max(padding, window.innerHeight - height - padding)
  return Math.min(Math.max(preferredTop, padding), maxY)
}
