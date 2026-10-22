import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="page-header admin-page__header">
      <div className="admin-page__header-main">
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="admin-page__desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  )
}
