import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { applyThemeTransition } from '../../utils/themeTransition'
import FixedAnchoredMenu from '../../components/FixedAnchoredMenu'
import { clampVerticalPosition } from '../../utils/viewportPlacement'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Settings as SettingsIcon,
  Server,
  Share2,
  Link as LinkIcon,
  Users as UsersIcon,
  UserCog,
  FolderTree,
  Database,
  Info,
  BookOpen,
  LogOut,
  Moon,
  Sun,
  Palette,
  Eye,
  ListTodo,
  Search,
  Bell,
  Home,
  Scale,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Languages,
} from 'lucide-react'
import { api } from '../../utils/api'
import '../../layouts/ManageAppLayout.css'
import Settings from './Settings'
import Drivers from './Drivers'
import Users from './Users'
import Groups from './Groups'
import Shares from './Shares'
import Links from './Links'
import Metadata from './Metadata'
import Backup from './Backup'
import About from './About'
import Tasks from './Tasks'
import SearchManagement from './SearchManagement'
import Notifications from './Notifications'
import LoadBalance from './LoadBalance'

interface DashboardProps {
  onLogout: () => void
}

type IconType = ComponentType<{ size?: number; className?: string }>

type NavItem = {
  path: string
  label: string
  icon: IconType
  external?: boolean
}

type NavGroup = {
  id: string
  title: string
  icon: IconType
  items: NavItem[]
}

const MOBILE_MQ = '(max-width: 800px)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function groupForPath(groups: NavGroup[], pathname: string): string | undefined {
  return groups.find((g) => g.items.some((item) => !item.external && item.path === pathname))?.id
}

function itemForPath(groups: NavGroup[], pathname: string): NavItem | undefined {
  for (const group of groups) {
    const hit = group.items.find((item) => !item.external && item.path === pathname)
    if (hit) return hit
  }
  return undefined
}

function NavSubLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const ItemIcon = item.icon
  if (item.external) {
    return (
      <a
        href={item.path}
        target="_blank"
        rel="noopener noreferrer"
        className="nav-sub-item menu-item"
        onClick={onNavigate}
      >
        <ItemIcon size={20} className="menu-item-icon" />
        <span className="menu-item-label">{item.label}</span>
      </a>
    )
  }
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `nav-sub-item menu-item ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
    >
      <ItemIcon size={20} className="menu-item-icon" />
      <span className="menu-item-label">{item.label}</span>
    </NavLink>
  )
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const contentRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const langAnchorRef = useRef<HTMLDivElement>(null)

  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [flyoutGroupId, setFlyoutGroupId] = useState<string | null>(null)
  const [flyoutAnchorTop, setFlyoutAnchorTop] = useState(56)
  const [flyoutTop, setFlyoutTop] = useState(56)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [siteTitle, setSiteTitle] = useState('YaoList')
  const [siteIcon, setSiteIcon] = useState('/favicon.ico')

  const navGroups = useMemo<NavGroup[]>(
    () => [
      {
        id: 'site',
        title: t('menu.siteManagement'),
        icon: SettingsIcon,
        items: [
          { path: '/manage/settings/basic', label: t('menu.basicSettings'), icon: SettingsIcon },
          { path: '/manage/settings/style', label: t('menu.styleSettings'), icon: Palette },
          { path: '/manage/settings/preview', label: t('menu.previewSettings'), icon: Eye },
          { path: '/manage/settings/push', label: t('menu.pushSettings'), icon: Bell },
        ],
      },
      {
        id: 'users',
        title: t('menu.userSettings'),
        icon: UsersIcon,
        items: [
          { path: '/manage/users', label: t('menu.userManagement'), icon: UsersIcon },
          { path: '/manage/groups', label: t('menu.groupManagement'), icon: UserCog },
        ],
      },
      {
        id: 'system',
        title: t('menu.systemFeatures'),
        icon: Server,
        items: [
          { path: '/manage/drivers', label: t('menu.driverManagement'), icon: Server },
          { path: '/manage/shares', label: t('menu.shareManagement'), icon: Share2 },
          { path: '/manage/links', label: t('menu.linkManagement'), icon: LinkIcon },
          { path: '/manage/metadata', label: t('menu.metadataManagement'), icon: FolderTree },
          { path: '/manage/tasks', label: t('menu.taskManagement'), icon: ListTodo },
          { path: '/manage/search', label: t('menu.searchManagement'), icon: Search },
          { path: '/manage/load-balance', label: t('menu.loadBalance'), icon: Scale },
          { path: '/manage/backup', label: t('menu.backupRestore'), icon: Database },
          { path: '/manage/about', label: t('menu.about'), icon: Info },
          {
            path: 'https://docs.ylist.org',
            label: t('menu.documentation'),
            icon: BookOpen,
            external: true,
          },
        ],
      },
    ],
    [t],
  )

  const currentPageLabel = useMemo(() => {
    const item = itemForPath(navGroups, location.pathname)
    return item?.label ?? siteTitle
  }, [navGroups, location.pathname, siteTitle])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark)
    document.body.classList.toggle('dark-mode', isDark)
    localStorage.setItem('darkMode', String(isDark))
  }, [isDark])

  useEffect(() => {
    const loadSiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/public')
        if (response.ok) {
          const data = await response.json()
          if (data.site_title) setSiteTitle(data.site_title)
          if (data.site_icon) setSiteIcon(data.site_icon)
        }
      } catch {}
    }
    loadSiteSettings()
  }, [])

  useEffect(() => {
    const activeId = groupForPath(navGroups, location.pathname)
    if (activeId) {
      setExpanded((c) => ({ ...c, [activeId]: true }))
      setFlyoutGroupId(null)
    }
  }, [location.pathname, navGroups])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 })
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false)
  }, [isMobile])

  useEffect(() => {
    document.title = `${currentPageLabel} - ${siteTitle}`
  }, [currentPageLabel, siteTitle])

  useLayoutEffect(() => {
    if (!flyoutGroupId || !flyoutRef.current) return
    const height = flyoutRef.current.offsetHeight
    setFlyoutTop(clampVerticalPosition(flyoutAnchorTop, height))
  }, [flyoutGroupId, flyoutAnchorTop])

  useEffect(() => {
    if (!flyoutGroupId) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (flyoutRef.current?.contains(target)) return
      if ((target as Element).closest?.('.nav-group-trigger')) return
      setFlyoutGroupId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [flyoutGroupId])

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
      document.cookie = 'yaolist_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      onLogout()
    } catch {
      document.cookie = 'yaolist_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      onLogout()
    }
  }

  function toggleGroup(groupId: string) {
    if (!isMobile && collapsed) {
      setFlyoutGroupId((c) => (c === groupId ? null : groupId))
      return
    }
    setExpanded((c) => ({ ...c, [groupId]: !c[groupId] }))
  }

  const flyoutGroup = flyoutGroupId ? navGroups.find((g) => g.id === flyoutGroupId) : undefined

  function renderNav(opts: { collapsedMode: boolean; onNavigate?: () => void }) {
    const { collapsedMode, onNavigate } = opts
    return (
      <>
        {navGroups.map((group) => {
          const Icon = group.icon
          const isOpen = collapsedMode ? flyoutGroupId === group.id : Boolean(expanded[group.id])
          return (
            <div key={group.id} className={`nav-group ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="nav-group-trigger menu-item"
                aria-expanded={isOpen}
                title={group.title}
                onClick={(e) => {
                  if (!isMobile && collapsed) {
                    setFlyoutAnchorTop(e.currentTarget.getBoundingClientRect().top)
                  }
                  toggleGroup(group.id)
                }}
              >
                <Icon size={20} className="menu-item-icon" />
                {!collapsedMode && (
                  <>
                    <span className="menu-item-label">{group.title}</span>
                    <ChevronDown size={18} className={`nav-group-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden />
                  </>
                )}
              </button>
              {!collapsedMode && (
                <div className={`nav-sub-wrap ${isOpen ? 'is-open' : ''}`}>
                  <div className="nav-sub-inner">
                    <ul className="nav-sub-list">
                      {group.items.map((item) => (
                        <li key={item.path}>
                          <NavSubLink item={item} onNavigate={onNavigate} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="sidebar-spacer" />
        <ul className="menu-list menu-list-footer">
          <li>
            <button
              type="button"
              className="menu-item"
              onClick={(e) => applyThemeTransition(() => setIsDark(!isDark), { x: e.clientX, y: e.clientY })}
              title={t('dashboard.themeToggle')}
            >
              {isDark ? <Moon size={18} className="menu-item-icon" /> : <Sun size={18} className="menu-item-icon" />}
              {!opts.collapsedMode && <span className="menu-item-label">{t('dashboard.themeToggle')}</span>}
            </button>
          </li>
          <li>
            <button type="button" className="menu-item" onClick={() => void handleLogout()} title={t('common.logout')}>
              <LogOut size={18} className="menu-item-icon" />
              {!opts.collapsedMode && <span className="menu-item-label">{t('common.logout')}</span>}
            </button>
          </li>
        </ul>
      </>
    )
  }

  return (
    <div
      className={`app-shell ambient-surface ${isMobile ? 'app-shell--mobile' : ''} ${mobileMenuOpen ? 'app-shell--menu-open' : ''}`}
    >
      <aside className={`sidebar-container sidebar-container--desktop ${collapsed ? 'collapsed' : 'expanded'}`}>
        <div className={`sidebar-header ${collapsed ? 'collapsed-header' : ''}`}>
          {!collapsed ? (
            <>
              <img src={siteIcon} alt="" className="sidebar-logo-img" />
              <div className="sidebar-logo-text">{siteTitle}</div>
            </>
          ) : (
            <img src={siteIcon} alt={siteTitle} className="sidebar-logo-img" />
          )}
        </div>
        <nav className="sidebar-nav" aria-label={siteTitle}>
          {renderNav({ collapsedMode: collapsed })}
        </nav>
        {collapsed && flyoutGroup && (
          <div ref={flyoutRef} className="sidebar-flyout" role="menu" style={{ top: flyoutTop }}>
            <p className="sidebar-flyout-title">{flyoutGroup.title}</p>
            <ul className="nav-sub-list">
              {flyoutGroup.items.map((item) => (
                <li key={item.path}>
                  <NavSubLink item={item} onNavigate={() => setFlyoutGroupId(null)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => {
            setCollapsed((v) => !v)
            setFlyoutGroupId(null)
          }}
          aria-label={collapsed ? '展开菜单' : '收起菜单'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      <div
        className={`mobile-nav-backdrop ${mobileMenuOpen ? 'is-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />
      <aside className={`mobile-nav-drawer ${mobileMenuOpen ? 'is-open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="sidebar-header">
          <div className="sidebar-logo-text">{siteTitle}</div>
          <button type="button" className="mobile-nav-drawer__close" onClick={() => setMobileMenuOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <nav className="sidebar-nav">{renderNav({ collapsedMode: false, onNavigate: () => setMobileMenuOpen(false) })}</nav>
      </aside>

      <main className="app-main">
        {isMobile ? (
          <header className="mobile-topbar">
            <h1 className="mobile-topbar__title">{currentPageLabel}</h1>
            <button type="button" className="mobile-topbar__menu" onClick={() => setMobileMenuOpen((o) => !o)}>
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </header>
        ) : (
          <header className="app-topbar">
            <div className="app-topbar__actions">
              <div ref={langAnchorRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="app-topbar__icon-btn"
                  title={t('tooltip.languageSwitch')}
                  onClick={() => setShowLangMenu(!showLangMenu)}
                >
                  <Languages size={18} />
                </button>
                <FixedAnchoredMenu
                  open={showLangMenu}
                  anchorRef={langAnchorRef}
                  className="app-topbar__lang-menu app-topbar__lang-menu--fixed"
                  align="end"
                  zIndex={1200}
                >
                  <button
                    type="button"
                    className={i18n.language === 'zh-CN' ? 'active' : ''}
                    onClick={() => {
                      i18n.changeLanguage('zh-CN')
                      localStorage.setItem('language', 'zh-CN')
                      setShowLangMenu(false)
                    }}
                  >
                    简体中文
                  </button>
                  <button
                    type="button"
                    className={i18n.language === 'en-US' ? 'active' : ''}
                    onClick={() => {
                      i18n.changeLanguage('en-US')
                      localStorage.setItem('language', 'en-US')
                      setShowLangMenu(false)
                    }}
                  >
                    English
                  </button>
                </FixedAnchoredMenu>
              </div>
              <Link to="/" className="app-topbar__icon-btn" title={t('menu.backToHome')}>
                <Home size={18} />
              </Link>
            </div>
          </header>
        )}

        <div className="app-content" ref={contentRef}>
          <div className="page-container page-container--entity-list" key={location.pathname}>
            <Routes>
              <Route path="/" element={<Drivers />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/shares" element={<Shares />} />
              <Route path="/links" element={<Links />} />
              <Route path="/users" element={<Users />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/metadata" element={<Metadata />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/search" element={<SearchManagement />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/load-balance" element={<LoadBalance />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  )
}
