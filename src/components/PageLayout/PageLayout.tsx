import { type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import './PageLayout.css'

export interface PageTab {
  key: string
  label: string
}

interface PageLayoutProps {
  tabs?: PageTab[]
  activeTab?: string
  onTabChange?: (key: string) => void
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  children: ReactNode
}

export function PageLayout({ tabs, activeTab, onTabChange, leftSlot, rightSlot, children }: PageLayoutProps) {
  const hasToolbar = leftSlot || rightSlot

  return (
    <div className="page-layout">
      {tabs && tabs.length > 0 && (
        <div className="page-layout__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`page-layout__tab ${activeTab === tab.key ? 'page-layout__tab--active' : ''}`}
              onClick={() => onTabChange?.(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {hasToolbar && (
        <div className="page-layout__toolbar">
          <div className="page-layout__left">{leftSlot}</div>
          <div className="page-layout__right">{rightSlot}</div>
        </div>
      )}

      <div className="page-layout__content">
        {children}
      </div>

      <div className="page-layout__footer">
        <button className="page-layout__help-btn" title="帮助">
          <HelpCircle size={16} />
          <span>帮助</span>
        </button>
      </div>
    </div>
  )
}
