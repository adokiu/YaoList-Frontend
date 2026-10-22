import { useState, useContext, useRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  ChevronRight, Home, Sun, Moon, Languages, Lock
} from 'lucide-react'
import { SharedContext } from '../../pages/public/FileRouter'
import { Tooltip } from '../Tooltip/Tooltip'
import FixedAnchoredMenu from '../FixedAnchoredMenu'
import TaskSidebar from '../TaskSidebar'
import UserSettingsSidebar from '../UserSettingsSidebar'
import { MetaContentRenderer } from './utils'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import '../../styles/pages/file-browser.scss'

interface UserPermissions {
  read_files: boolean
  create_upload: boolean
  rename_files: boolean
  move_files: boolean
  copy_files: boolean
  delete_files: boolean
  allow_direct_link: boolean
  allow_share: boolean
  extract_files: boolean
  is_admin: boolean
}

interface FilePageLayoutProps {
  currentPath: string
  children: ReactNode
  // 元信息
  header?: string
  readme?: string
  // 密码相关
  passwordRequired?: boolean
  passwordInput?: string
  passwordError?: boolean
  passwordLoading?: boolean
  onPasswordChange?: (value: string) => void
  onPasswordSubmit?: () => void
  // 额外的 header 按钮（由子组件提供）
  headerButtons?: ReactNode
  // 权限
  permissions?: UserPermissions | null
  // 任务面板控制
  taskSidebarVisible?: boolean
  onTaskSidebarClose?: () => void
  onCancelUpload?: (taskId: string) => void
}

export default function FilePageLayout({
  currentPath,
  children,
  header,
  readme,
  passwordRequired = false,
  passwordInput = '',
  passwordError = false,
  passwordLoading = false,
  onPasswordChange,
  onPasswordSubmit,
  headerButtons,
  permissions,
  taskSidebarVisible = false,
  onTaskSidebarClose,
  onCancelUpload
}: FilePageLayoutProps) {
  const { t } = useTranslation()
  const shared = useContext(SharedContext)
  const { siteTitle, siteIcon, darkMode, language, hasBackground, isLoggedIn, username } = shared
  
  const [showLangMenu, setShowLangMenu] = useState(false)
  const langAnchorRef = useRef<HTMLDivElement>(null)
  const [userSettingsDialog, setUserSettingsDialog] = useState(false)

  // 语言切换
  const toggleLanguage = (lang: string) => {
    shared.setLanguage(lang)
    setShowLangMenu(false)
  }

  // 面包屑
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: t('fileBrowser.home'), path: '' }]
    const parts = currentPath.split('/').filter(Boolean)
    const breadcrumbs = [{ name: t('fileBrowser.home'), path: '' }]
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      breadcrumbs.push({ name: decodeURIComponent(part), path })
    })
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className={`file-browser ${hasBackground ? 'file-browser--with-bg' : ''}`}>
      {/* 顶部导航 */}
      <div className="file-browser__header">
        <div className="file-browser__header-left">
          <img src={siteIcon} alt={siteTitle} className="file-browser__logo" />
          <h1 className="file-browser__site-title">{siteTitle}</h1>
        </div>
        <div className="file-browser__header-right">
          {/* 子组件提供的额外按钮 */}
          {headerButtons}
          
          {/* 语言切换 */}
          <div className="file-browser__lang-switch" ref={langAnchorRef}>
            <Tooltip text={t('fileBrowser.switchLanguage')} position="bottom">
              <button 
                className="file-browser__header-btn"
                onClick={() => setShowLangMenu(!showLangMenu)}
              >
                <Languages size={18} />
              </button>
            </Tooltip>
            <FixedAnchoredMenu
              open={showLangMenu}
              anchorRef={langAnchorRef}
              className="file-browser__lang-menu"
              align="end"
            >
              <button 
                className={`file-browser__lang-item ${language === 'zh-CN' ? 'active' : ''}`}
                onClick={() => toggleLanguage('zh-CN')}
              >
                简体中文
              </button>
              <button 
                className={`file-browser__lang-item ${language === 'en-US' ? 'active' : ''}`}
                onClick={() => toggleLanguage('en-US')}
              >
                English
              </button>
            </FixedAnchoredMenu>
          </div>
          
          {/* 暗色模式切换 */}
          <Tooltip text={darkMode ? t('fileBrowser.switchToLight') : t('fileBrowser.switchToDark')} position="bottom">
            <button 
              className="file-browser__header-btn"
              onClick={(e) => shared.setDarkMode(!darkMode, { x: e.clientX, y: e.clientY })}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </Tooltip>
        </div>
      </div>
      
      {/* 顶部说明 (Header) */}
      {header && !passwordRequired && (
        <MetaContentRenderer content={header} className="file-browser__meta-card--header" />
      )}

      {/* 面包屑卡片 */}
      <div className="file-browser__breadcrumb-card">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="file-browser__breadcrumb-item">
            {index === 0 ? (
              <Link to="/" className="file-browser__breadcrumb-link">
                <Home size={18} />
                <span>{crumb.name}</span>
              </Link>
            ) : (
              <>
                <ChevronRight size={18} className="file-browser__breadcrumb-separator" />
                <Link 
                  to={`/${crumb.path}`}
                  className={`file-browser__breadcrumb-link ${index === breadcrumbs.length - 1 ? 'file-browser__breadcrumb-link--current' : ''}`}
                >
                  {crumb.name}
                </Link>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 主内容卡片 */}
      <div className="file-browser__main-card">
        {passwordRequired ? (
          <div className={`file-browser__password ${passwordError ? 'shake' : ''}`}>
            <div className="file-browser__password-icon">
              <Lock size={48} />
            </div>
            <h2>{t('fileBrowser.passwordRequired') || '需要密码'}</h2>
            <p>{t('fileBrowser.passwordHint') || '此目录需要密码才能访问'}</p>
            <div className="file-browser__password-form">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => onPasswordChange?.(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !passwordLoading && onPasswordSubmit?.()}
                placeholder={t('fileBrowser.enterPassword') || '请输入密码'}
                className={passwordError ? 'error' : ''}
                autoFocus
                disabled={passwordLoading}
              />
              <button onClick={onPasswordSubmit} disabled={passwordLoading || !passwordInput}>
                {passwordLoading ? (
                  <span className="file-browser__password-loading"></span>
                ) : (
                  t('fileBrowser.confirm') || '确认'
                )}
              </button>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* 底部说明 (Readme) */}
      {readme && !passwordRequired && (
        <MetaContentRenderer content={readme} className="file-browser__meta-card--readme" />
      )}

      {/* 页面底部 */}
      <div className="file-browser__page-footer">
        {isLoggedIn && username && (
          <>
            <span className="file-browser__page-footer-user">{username}</span>
            <span className="file-browser__page-footer-sep">|</span>
          </>
        )}
        {isLoggedIn ? (
          <a 
            href="#" 
            className="file-browser__page-footer-link"
            onClick={(e) => { e.preventDefault(); setUserSettingsDialog(true) }}
          >
            {t('userSettings.title')}
          </a>
        ) : (
          <a href="/login" className="file-browser__page-footer-link">{t('login.loginButton')}</a>
        )}
      </div>

      {/* 任务侧边栏 */}
      <TaskSidebar 
        visible={taskSidebarVisible} 
        onClose={() => onTaskSidebarClose?.()} 
        alwaysConnect={true}
        onCancelUpload={onCancelUpload}
      />

      {/* 用户设置侧边栏 */}
      <UserSettingsSidebar 
        visible={userSettingsDialog} 
        onClose={() => setUserSettingsDialog(false)}
        permissions={permissions || null}
      />
    </div>
  )
}
