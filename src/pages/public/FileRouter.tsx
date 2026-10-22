import { useState, useEffect, useRef, createContext, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  ChevronRight, Home, Sun, Moon, Languages, Lock,
  RefreshCw, FilePlus, FolderPlus, Upload, CheckSquare, ListTodo
} from 'lucide-react'
import { api } from '../../utils/api'
import { Tooltip } from '../../components/Tooltip/Tooltip'
import FixedAnchoredMenu from '../../components/FixedAnchoredMenu'
import TaskSidebar from '../../components/TaskSidebar'
import UserSettingsSidebar from '../../components/UserSettingsSidebar'
import { MetaContentRenderer } from '../../components/FilePageLayout'
import { healStuckDocumentScrollStyles } from '../../utils/scrollLock'
import { applyThemeTransition, type ThemeTransitionOrigin } from '../../utils/themeTransition'
import FileBrowserContent from './FileBrowserContent'
import FilePreviewContent from './FilePreviewContent'
import LoginBg from './LoginBg'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import '../../styles/pages/file-browser.scss'

// ============================================================================
// 类型定义
// ============================================================================

export interface UserPermissions {
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

export interface PageState {
  // 元信息
  header: string
  readme: string
  // 密码
  passwordRequired: boolean
  passwordInput: string
  passwordError: boolean
  passwordLoading: boolean
  // 内容加载状态
  contentLoading: boolean
}

type PathType = 'loading' | 'folder' | 'file'

// ============================================================================
// 共享上下文
// ============================================================================

export const SharedContext = createContext<{
  // 站点配置
  backgroundImage: string
  darkMode: boolean
  setDarkMode: (value: boolean, origin?: ThemeTransitionOrigin) => void
  language: string
  setLanguage: (value: string) => void
  siteTitle: string
  siteIcon: string
  hasBackground: boolean
  glassEffect: boolean
  // 用户状态
  isLoggedIn: boolean
  setIsLoggedIn: (value: boolean) => void
  username: string | null
  permissions: UserPermissions | null
  // 页面状态（由子组件更新）
  pageState: PageState
  setPageState: (state: Partial<PageState>) => void
  // 任务面板
  taskSidebarVisible: boolean
  setTaskSidebarVisible: (visible: boolean) => void
  onCancelUpload?: (taskId: string) => void
  setOnCancelUpload: (fn: ((taskId: string) => void) | undefined) => void
  // header 额外按钮（由子组件提供）
  headerButtons: React.ReactNode
  setHeaderButtons: (buttons: React.ReactNode) => void
  // 路径
  currentPath: string
  // 悬浮工具栏回调（由 FileBrowserContent 提供）
  floatingToolbar: {
    onRefresh?: () => void
    onNewFile?: () => void
    onNewFolder?: () => void
    onUpload?: () => void
    selectionMode: boolean
    onToggleSelection?: () => void
  }
  setFloatingToolbar: (toolbar: Partial<{
    onRefresh?: () => void
    onNewFile?: () => void
    onNewFolder?: () => void
    onUpload?: () => void
    selectionMode: boolean
    onToggleSelection?: () => void
  }>) => void
  // 密码提交回调（由子组件提供）
  onPasswordSubmit?: (password: string) => void
  setOnPasswordSubmit: (fn: ((password: string) => void) | undefined) => void
}>({
  backgroundImage: '',
  darkMode: false,
  setDarkMode: () => {},
  language: 'zh-CN',
  setLanguage: () => {},
  siteTitle: 'YaoList',
  siteIcon: '/favicon.ico',
  hasBackground: false,
  glassEffect: false,
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  username: null,
  permissions: null,
  pageState: { header: '', readme: '', passwordRequired: false, passwordInput: '', passwordError: false, passwordLoading: false, contentLoading: true },
  setPageState: () => {},
  taskSidebarVisible: false,
  setTaskSidebarVisible: () => {},
  onCancelUpload: undefined,
  setOnCancelUpload: () => {},
  headerButtons: null,
  setHeaderButtons: () => {},
  currentPath: '',
  floatingToolbar: { selectionMode: false },
  setFloatingToolbar: () => {},
  onPasswordSubmit: undefined,
  setOnPasswordSubmit: () => {}
})

// 兼容旧的 BackgroundContext
export const BackgroundContext = SharedContext

// ============================================================================
// 工具函数
// ============================================================================

// 获取路径的密码（包括继承父目录密码）
export const getPasswordForPath = (targetPath: string): string => {
  try {
    const pathPassword = JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
    if (pathPassword[targetPath]) return pathPassword[targetPath]
    const parts = targetPath.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = '/' + parts.slice(0, i).join('/')
      const normalizedParent = parentPath === '' ? '/' : parentPath
      if (pathPassword[normalizedParent]) return pathPassword[normalizedParent]
    }
    if (pathPassword['/']) return pathPassword['/']
  } catch {}
  return ''
}

// 保存路径密码
export const savePasswordForPath = (path: string, password: string) => {
  try {
    const pathPassword = JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
    pathPassword[path] = password
    sessionStorage.setItem('pathPasswords', JSON.stringify(pathPassword))
  } catch {}
}

// 通过文件名判断是否是文件
const guessIsFile = (path: string): boolean => {
  const fileName = path.split('/').pop() || ''
  return fileName.includes('.') && !fileName.startsWith('.')
}

// ============================================================================
// 主组件
// ============================================================================

export default function FileRouter() {
  const { '*': pathParam } = useParams()
  const currentPath = pathParam || ''
  const { t, i18n } = useTranslation()
  
  // ========== 站点配置状态 ==========
  const [backgroundImage, setBackgroundImage] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'zh-CN')
  const [siteTitle, setSiteTitle] = useState('YaoList')
  const [siteIcon, setSiteIcon] = useState('/favicon.ico')
  const [glassEffect, setGlassEffect] = useState(false)
  
  // ========== 用户状态 ==========
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  
  // ========== 页面状态 ==========
  const [pageState, setPageStateInternal] = useState<PageState>({
    header: '',
    readme: '',
    passwordRequired: false,
    passwordInput: '',
    passwordError: false,
    passwordLoading: false,
    contentLoading: true
  })
  
  const setPageState = useCallback((state: Partial<PageState>) => {
    setPageStateInternal(prev => ({ ...prev, ...state }))
  }, [])
  
  // ========== 路径类型 ==========
  const [pathType, setPathType] = useState<PathType>('loading')
  const checkedPaths = useRef<Map<string, boolean>>(new Map())
  
  // ========== UI 状态 ==========
  const [showLangMenu, setShowLangMenu] = useState(false)
  const langAnchorRef = useRef<HTMLDivElement>(null)
  const [userSettingsDialog, setUserSettingsDialog] = useState(false)
  const [taskSidebarVisible, setTaskSidebarVisible] = useState(false)
  const [headerButtons, setHeaderButtons] = useState<React.ReactNode>(null)
  const [onCancelUpload, setOnCancelUploadState] = useState<((taskId: string) => void) | undefined>(undefined)
  // 使用 useRef 存储工具栏回调，避免无限循环
  const floatingToolbarRef = useRef<{
    onRefresh?: () => void
    onNewFile?: () => void
    onNewFolder?: () => void
    onUpload?: () => void
    selectionMode: boolean
    onToggleSelection?: () => void
  }>({ selectionMode: false })
  
  const setFloatingToolbar = useCallback((toolbar: Partial<typeof floatingToolbarRef.current>) => {
    floatingToolbarRef.current = { ...floatingToolbarRef.current, ...toolbar }
  }, [])
  
  const setOnCancelUpload = useCallback((fn: ((taskId: string) => void) | undefined) => {
    setOnCancelUploadState(() => fn)
  }, [])
  
  // 密码提交回调
  const [onPasswordSubmit, setOnPasswordSubmitState] = useState<((password: string) => void) | undefined>(undefined)
  const setOnPasswordSubmit = useCallback((fn: ((password: string) => void) | undefined) => {
    setOnPasswordSubmitState(() => fn)
  }, [])
  
  // ========== Refs ==========
  const settingsLoaded = useRef(false)

  // ========== 加载站点设置 ==========
  useEffect(() => {
    if (settingsLoaded.current) return
    settingsLoaded.current = true
    
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/public')
        if (response.ok) {
          const data = await response.json()
          if (data.background_image) setBackgroundImage(data.background_image)
          if (data.site_title) {
            setSiteTitle(data.site_title)
            document.title = data.site_title
          }
          if (data.site_icon) setSiteIcon(data.site_icon)
          setGlassEffect(!!data.glass_effect)
        }
      } catch {}
    }
    loadSettings()
    
    // 检查登录状态和权限
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/permissions', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.is_guest && data.guest_disabled) {
            window.location.href = '/login?msg=guest_disabled'
            return
          }
          setIsLoggedIn(!data.is_guest)
          setUsername(data.user?.username ?? null)
          if (data.permissions) {
            setPermissions({
              read_files: !!data.permissions.read_files,
              create_upload: !!data.permissions.create_upload,
              rename_files: !!data.permissions.rename_files,
              move_files: !!data.permissions.move_files,
              copy_files: !!data.permissions.copy_files,
              delete_files: !!data.permissions.delete_files,
              allow_direct_link: !!data.permissions.allow_direct_link,
              allow_share: !!data.permissions.allow_share,
              extract_files: !!data.permissions.extract_files,
              is_admin: !!data.permissions.is_admin
            })
          }
        }
      } catch {}
    }
    checkAuth()
    healStuckDocumentScrollStyles()
  }, [])

  // ========== 深色模式 ==========
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])
  
  const handleSetDarkMode = useCallback((value: boolean, origin?: ThemeTransitionOrigin) => {
    applyThemeTransition(() => {
      setDarkMode(value)
      localStorage.setItem('darkMode', String(value))
      document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light')
    }, origin)
  }, [])

  // ========== 语言切换 ==========
  const handleSetLanguage = useCallback((lang: string) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
    i18n.changeLanguage(lang)
    setShowLangMenu(false)
    healStuckDocumentScrollStyles()
  }, [i18n])

  // ========== 毛玻璃效果 ==========
  useEffect(() => {
    if (glassEffect) {
      document.documentElement.classList.add('glass-enabled')
    } else {
      document.documentElement.classList.remove('glass-enabled')
    }
  }, [glassEffect])

  // ========== 路径类型检测 ==========
  useEffect(() => {
    const checkPathType = async () => {
      if (!currentPath) {
        setPathType('folder')
        return
      }

      if (checkedPaths.current.has(currentPath)) {
        const cached = checkedPaths.current.get(currentPath)!
        setPathType(cached ? 'folder' : 'file')
        return
      }

      setPathType('loading')

      try {
        const fullPath = '/' + currentPath
        const password = getPasswordForPath(fullPath)
        const response = await api.post('/api/fs/get', { path: fullPath, password })
        
        if (response.data.code === 200) {
          const isDir = response.data.data.is_dir
          checkedPaths.current.set(currentPath, isDir)
          setPathType(isDir ? 'folder' : 'file')
        } else if (response.data.code === 403) {
          const isFile = guessIsFile(currentPath)
          setPathType(isFile ? 'file' : 'folder')
        } else {
          const isFile = guessIsFile(currentPath)
          checkedPaths.current.set(currentPath, !isFile)
          setPathType(isFile ? 'file' : 'folder')
        }
      } catch {
        const isFile = guessIsFile(currentPath)
        checkedPaths.current.set(currentPath, !isFile)
        setPathType(isFile ? 'file' : 'folder')
      }
    }

    // 路径变化时只重置密码相关状态，不清空 header/readme，避免元信息卡片闪烁
    setPageState({ 
      passwordRequired: false, 
      passwordInput: '', 
      passwordError: false,
      passwordLoading: false
    })
    checkPathType()
  }, [currentPath, setPageState])

  // ========== 面包屑 ==========
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [{ name: t('fileBrowser.home'), path: '' }]
    const parts = currentPath.split('/').filter(Boolean)
    const crumbs = [{ name: t('fileBrowser.home'), path: '' }]
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      crumbs.push({ name: decodeURIComponent(part), path })
    })
    return crumbs
  }, [currentPath, t])

  // ========== 密码处理 ==========
  const handlePasswordSubmit = useCallback(async () => {
    if (!pageState.passwordInput) return
    
    const fullPath = currentPath ? `/${currentPath}` : '/'
    setPageState({ passwordLoading: true, passwordError: false })
    
    try {
      const response = await api.post('/api/fs/list', {
        path: fullPath,
        password: pageState.passwordInput,
        page: 1,
        per_page: 50,
        refresh: false
      })
      
      if (response.data.code === 403) {
        // 密码错误
        setPageState({ passwordError: true, passwordLoading: false })
        return
      }
      
      // 密码正确，保存到 sessionStorage
      const pathPasswords = JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
      pathPasswords[fullPath] = pageState.passwordInput
      sessionStorage.setItem('pathPasswords', JSON.stringify(pathPasswords))
      
      // 重置密码状态，触发子组件重新加载
      setPageState({ passwordRequired: false, passwordInput: '', passwordLoading: false, passwordError: false })
    } catch (err) {
      setPageState({ passwordError: true, passwordLoading: false })
    }
  }, [currentPath, pageState.passwordInput, setPageState])

  // ========== 计算值 ==========
  const hasBackground = !!(backgroundImage && !darkMode)
  const backgroundStyle = hasBackground ? {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {}

  // ========== 上下文值 ==========
  const sharedValue = useMemo(() => ({
    backgroundImage,
    darkMode,
    setDarkMode: handleSetDarkMode,
    language,
    setLanguage: handleSetLanguage,
    siteTitle,
    siteIcon,
    hasBackground,
    glassEffect,
    isLoggedIn,
    setIsLoggedIn,
    username,
    permissions,
    pageState,
    setPageState,
    taskSidebarVisible,
    setTaskSidebarVisible,
    onCancelUpload,
    setOnCancelUpload,
    headerButtons,
    setHeaderButtons,
    currentPath,
    floatingToolbar: floatingToolbarRef.current,
    setFloatingToolbar,
    onPasswordSubmit,
    setOnPasswordSubmit
  }), [
    backgroundImage, darkMode, handleSetDarkMode, language, handleSetLanguage,
    siteTitle, siteIcon, hasBackground, glassEffect, isLoggedIn, username, permissions,
    pageState, setPageState, taskSidebarVisible, onCancelUpload, setOnCancelUpload,
    headerButtons, currentPath, setFloatingToolbar,
    onPasswordSubmit, setOnPasswordSubmit
  ])

  // ========== 渲染 ==========
  return (
    <SharedContext.Provider value={sharedValue}>
      <div className={`file-router-bg ${hasBackground ? 'has-custom-bg' : ''}`} style={backgroundStyle}>
        {(darkMode || !backgroundImage) && <LoginBg darkMode={darkMode} />}
        <div className={`file-browser ${hasBackground ? 'file-browser--with-bg' : ''}`}>
          {/* ===== 顶部导航（始终渲染） ===== */}
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
                    onClick={() => handleSetLanguage('zh-CN')}
                  >
                    简体中文
                  </button>
                  <button 
                    className={`file-browser__lang-item ${language === 'en-US' ? 'active' : ''}`}
                    onClick={() => handleSetLanguage('en-US')}
                  >
                    English
                  </button>
                </FixedAnchoredMenu>
              </div>
              
              {/* 暗色模式切换 */}
              <Tooltip text={darkMode ? t('fileBrowser.switchToLight') : t('fileBrowser.switchToDark')} position="bottom">
                <button 
                  className="file-browser__header-btn"
                  onClick={(e) => handleSetDarkMode(!darkMode, { x: e.clientX, y: e.clientY })}
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </Tooltip>
            </div>
          </div>
          
          {/* ===== 顶部说明（始终渲染位置） ===== */}
          {pageState.header && !pageState.passwordRequired && (
            <MetaContentRenderer content={pageState.header} className="file-browser__meta-card--header" />
          )}

          {/* ===== 面包屑卡片（始终渲染） ===== */}
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

          {/* ===== 主内容卡片（始终渲染容器） ===== */}
          <div className="file-browser__main-card">
            {pageState.passwordRequired ? (
              // 密码验证界面
              <div className={`file-browser__password ${pageState.passwordError ? 'shake' : ''}`}>
                <div className="file-browser__password-icon">
                  <Lock size={48} />
                </div>
                <h2>{t('fileBrowser.passwordRequired') || '需要密码'}</h2>
                <p>{t('fileBrowser.passwordHint') || '此目录需要密码才能访问'}</p>
                <div className="file-browser__password-form">
                  <input
                    type="password"
                    value={pageState.passwordInput}
                    onChange={(e) => setPageState({ passwordInput: e.target.value, passwordError: false })}
                    onKeyDown={(e) => e.key === 'Enter' && !pageState.passwordLoading && handlePasswordSubmit()}
                    placeholder={t('fileBrowser.enterPassword') || '请输入密码'}
                    className={pageState.passwordError ? 'error' : ''}
                    autoFocus
                    disabled={pageState.passwordLoading}
                  />
                  <button onClick={handlePasswordSubmit} disabled={pageState.passwordLoading || !pageState.passwordInput}>
                    {pageState.passwordLoading ? (
                      <span className="file-browser__password-loading"></span>
                    ) : (
                      t('fileBrowser.confirm') || '确认'
                    )}
                  </button>
                </div>
              </div>
            ) : pathType === 'loading' ? (
              // 加载中
              <div className="file-browser__loading">
                <div className="file-browser__spinner"></div>
                <p>{t('fileBrowser.loading')}</p>
              </div>
            ) : (
              // 内容区域（带加载动画覆盖层）
              <div className="file-browser__content-wrapper">
                {/* 加载动画覆盖层（仅文件夹模式） */}
                {pathType === 'folder' && (
                  <div className={`file-browser__content-loading ${pageState.contentLoading ? 'visible' : ''}`}>
                    <div className="file-browser__spinner"></div>
                  </div>
                )}
                {/* 实际内容（渐显效果） */}
                <div className={`file-browser__content-inner ${pathType === 'folder' ? (!pageState.contentLoading ? 'loaded' : '') : 'loaded'}`}>
                  {pathType === 'folder' ? (
                    <FileBrowserContent />
                  ) : (
                    <FilePreviewContent />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== 工具栏（仅文件夹模式显示） ===== */}
          {pathType === 'folder' && (
            <div className="file-browser__floating-toolbar">
            <Tooltip text={t('fileBrowser.refresh')} position="left">
              <button 
                className="file-browser__toolbar-btn file-browser__toolbar-btn--refresh" 
                onClick={() => floatingToolbarRef.current.onRefresh?.()}
              >
                <RefreshCw size={20} />
              </button>
            </Tooltip>
            
            {permissions?.create_upload && (
              <>
                <Tooltip text={t('fileBrowser.newFile')} position="left">
                  <button 
                    className="file-browser__toolbar-btn file-browser__toolbar-btn--newfile"
                    onClick={() => floatingToolbarRef.current.onNewFile?.()}
                  >
                    <FilePlus size={20} />
                  </button>
                </Tooltip>
                <Tooltip text={t('fileBrowser.newFolder')} position="left">
                  <button 
                    className="file-browser__toolbar-btn file-browser__toolbar-btn--newfolder"
                    onClick={() => floatingToolbarRef.current.onNewFolder?.()}
                  >
                    <FolderPlus size={20} />
                  </button>
                </Tooltip>
                <Tooltip text={t('fileBrowser.upload')} position="left">
                  <button 
                    className="file-browser__toolbar-btn file-browser__toolbar-btn--upload"
                    onClick={() => floatingToolbarRef.current.onUpload?.()}
                  >
                    <Upload size={20} />
                  </button>
                </Tooltip>
              </>
            )}
            
            <Tooltip text={floatingToolbarRef.current.selectionMode ? t('fileBrowser.cancelMultiSelect') : t('fileBrowser.multiSelect')} position="left">
              <button 
                className="file-browser__toolbar-btn file-browser__toolbar-btn--select"
                onClick={() => floatingToolbarRef.current.onToggleSelection?.()}
              >
                <CheckSquare size={20} />
              </button>
            </Tooltip>
            
            <Tooltip text={t('fileBrowser.taskList')} position="left">
              <button 
                className="file-browser__toolbar-btn file-browser__toolbar-btn--tasks"
                onClick={() => setTaskSidebarVisible(true)}
              >
                <ListTodo size={20} />
              </button>
            </Tooltip>
            </div>
          )}

          {/* ===== 底部说明（始终渲染位置） ===== */}
          {pageState.readme && !pageState.passwordRequired && (
            <MetaContentRenderer content={pageState.readme} className="file-browser__meta-card--readme" />
          )}

          {/* ===== 页面底部（始终渲染） ===== */}
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
        </div>

        {/* ===== 任务侧边栏（始终渲染） ===== */}
        <TaskSidebar 
          visible={taskSidebarVisible} 
          onClose={() => setTaskSidebarVisible(false)} 
          alwaysConnect={true}
          onCancelUpload={onCancelUpload}
        />

        {/* ===== 用户设置侧边栏（始终渲染） ===== */}
        <UserSettingsSidebar 
          visible={userSettingsDialog} 
          onClose={() => setUserSettingsDialog(false)}
          permissions={permissions}
        />
      </div>
    </SharedContext.Provider>
  )
}
