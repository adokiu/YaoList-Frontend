import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { anchorMenuPosition, type AnchorAlign } from '../utils/viewportPlacement'

interface FixedAnchoredMenuProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  className: string
  align?: AnchorAlign
  gap?: number
  zIndex?: number
  children: ReactNode
}

export default function FixedAnchoredMenu({
  open,
  anchorRef,
  className,
  align = 'end',
  gap = 8,
  zIndex = 1100,
  children,
}: FixedAnchoredMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden', position: 'fixed' })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return
    const anchorRect = anchor.getBoundingClientRect()
    const { width, height } = menu.getBoundingClientRect()
    const { x, y } = anchorMenuPosition(anchorRect, width, height, { align, gap })
    setStyle({
      position: 'fixed',
      top: y,
      left: x,
      right: 'auto',
      margin: 0,
      transform: 'none',
      visibility: 'visible',
      zIndex,
    })
  }, [open, align, gap, zIndex, anchorRef, children])

  if (!open) return null

  return createPortal(
    <div ref={menuRef} className={className} style={style}>
      {children}
    </div>,
    document.body
  )
}
