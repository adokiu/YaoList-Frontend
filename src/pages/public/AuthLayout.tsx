import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Languages } from 'lucide-react'
import LoginBg from './LoginBg'
import FixedAnchoredMenu from '../../components/FixedAnchoredMenu'
import { applyThemeTransition } from '../../utils/themeTransition'
import '../../styles/components/login.scss'

interface AuthContextType {
  siteTitle: string
  siteIcon: string
  allowRegistration: boolean
}

const AuthContext = createContext<AuthContextType>({
  siteTitle: 'YaoList',
  siteIcon: '/favicon.ico',
  allowRegistration: false
})

export const useAuthContext = () => useContext(AuthContext)

export default function AuthLayout() {
  const { i18n } = useTranslation()
  
  const [siteTitle, setSiteTitle] = useState('YaoList')
  const [siteIcon, setSiteIcon] = useState('/favicon.ico')
  const [backgroundImage, setBackgroundImage] = useState('')
  const [glassEffect, setGlassEffect] = useState(false)
  const [glassBlur, setGlassBlur] = useState(12)
  const [glassOpacity, setGlassOpacity] = useState(80)
  const [allowRegistration, setAllowRegistration] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  const [showLangMenu, setShowLangMenu] = useState(false)
  const langAnchorRef = useRef<HTMLDivElement>(null)

  const languageNames: Record<string, string> = {
    'zh-CN': '简体中文',
    'en-US': 'English',
  }

  const languages = Object.keys(i18n.options.resources || {}).map(code => ({
    code,
    name: languageNames[code] || code
  }))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    loadSiteSettings()
  }, [])

  const loadSiteSettings = async () => {
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        if (data.site_title) setSiteTitle(data.site_title)
        if (data.site_icon) setSiteIcon(data.site_icon)
        if (data.background_image) setBackgroundImage(data.background_image)
        if (data.glass_effect !== undefined) setGlassEffect(data.glass_effect)
        if (data.glass_blur !== undefined) setGlassBlur(data.glass_blur)
        if (data.glass_opacity !== undefined) setGlassOpacity(data.glass_opacity)
        if (data.allow_registration !== undefined) setAllowRegistration(data.allow_registration)
      }
    } catch {}
    setSettingsLoaded(true)
  }

  const useGlass = glassEffect && !darkMode
  const useBg = backgroundImage && !darkMode

  const cardStyle = useGlass ? {
    '--glass-blur': `${glassBlur}px`,
    '--glass-opacity': glassOpacity / 100,
  } as React.CSSProperties : {}

  return (
    <AuthContext.Provider value={{ siteTitle, siteIcon, allowRegistration }}>
      <div 
        className={`login__container ${darkMode ? 'login__container--dark' : ''}`}
        style={useBg ? { backgroundImage: `url(${backgroundImage})` } : {}}
      >
        {!useBg && <LoginBg darkMode={darkMode} />}
        
        <div className={`login__card ${useGlass ? 'login__card--glass' : ''}`} style={cardStyle}>
          <div className="login__header">
            <img src={siteIcon} alt="Logo" className="login__logo" />
            <h1 className="login__title">{siteTitle}</h1>
          </div>

          {settingsLoaded && <Outlet />}

          <div className="login__footer">
            <div className="login__lang-wrapper" ref={langAnchorRef}>
              <button 
                className="login__footer-btn"
                onClick={() => setShowLangMenu(!showLangMenu)}
              >
                <Languages size={28} />
              </button>
              <FixedAnchoredMenu
                open={showLangMenu}
                anchorRef={langAnchorRef}
                className="login__lang-menu"
                align="center"
                gap={10}
              >
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    className={`login__lang-item ${i18n.language === lang.code ? 'login__lang-item--active' : ''}`}
                    onClick={() => {
                      i18n.changeLanguage(lang.code)
                      setShowLangMenu(false)
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </FixedAnchoredMenu>
            </div>
            <button 
              className="login__footer-btn"
              onClick={(e) => applyThemeTransition(() => setDarkMode(!darkMode), { x: e.clientX, y: e.clientY })}
            >
              {darkMode ? <Sun size={28} /> : <Moon size={28} />}
            </button>
          </div>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
