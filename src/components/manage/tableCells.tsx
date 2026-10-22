import type { ReactNode } from 'react'

export function TableCell({ children, large }: { children: ReactNode; large?: boolean }) {
  return (
    <span className={`data-table-cell${large ? ' data-table-cell--lg' : ''}`}>{children}</span>
  )
}

export function TableActions({ children }: { children: ReactNode }) {
  return <div className="data-table-actions">{children}</div>
}

export function TableLinkButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className="data-table-link-btn"
      onClick={onClick}
      disabled={disabled}
      style={danger ? { color: 'hsl(var(--destructive))' } : undefined}
    >
      {children}
    </button>
  )
}
