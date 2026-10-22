import { useRef, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { anchorMenuPosition } from '../utils/viewportPlacement'

interface FilePreviewDropdownProps {
  label: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: 'start' | 'end'
  children: ReactNode
}

export default function FilePreviewDropdown({
  label,
  open,
  onOpenChange,
  align = 'start',
  children
}: FilePreviewDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 160 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const anchor = triggerRef.current.getBoundingClientRect()
    const minWidth = Math.max(anchor.width, 160)
    const menuEl = menuRef.current
    const menuHeight = menuEl?.offsetHeight ?? 240
    const menuWidth = menuEl?.offsetWidth ?? minWidth
    const { x, y } = anchorMenuPosition(anchor, menuWidth, menuHeight, {
      align: align === 'end' ? 'end' : 'start',
      gap: 4,
    })
    setMenuPos({ top: y, left: x, minWidth })
  }, [open, align, label, children])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onOpenChange(false)
    }
    const onScrollOrResize = () => onOpenChange(false)
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, onOpenChange])

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className="file-preview__dropdown-menu file-preview__dropdown-menu--fixed"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.minWidth
          }}
          role="listbox"
        >
          <div className="file-preview__dropdown-menu-surface">{children}</div>
        </div>,
        document.body
      )
    : null

  return (
    <div className={`file-preview__dropdown ${open ? 'file-preview__dropdown--open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="file-preview__dropdown-btn"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span>{label}</span>
        <ChevronDown size={16} className={open ? 'rotate' : ''} />
      </button>
      {menu}
    </div>
  )
}
