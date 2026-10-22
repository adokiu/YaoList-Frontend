import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, Check, X, ChevronDown } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/basic-settings.scss'

interface GeoIpStatus {
  loaded: boolean
  country_db: boolean
  city_db: boolean
  asn_db: boolean
  data_dir: string
}

export default function BasicSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    site_title: '',
    site_description: '',
    allow_registration: false,
    default_user_group: '',
    site_announcement: '',
    robots_txt: '',
    // Proxy settings / 代理设置
    proxy_max_speed: 0,        // bytes/sec, 0 = unlimited / 字节/秒，0表示无限制
    proxy_max_concurrent: 0,   // 0 = unlimited / 0表示无限制
    // Download domain / 下载域名
    download_domain: '',       // empty = use current domain / 空表示使用当前域名
    // Link settings / 链接设置
    link_expiry_minutes: 15    // default 15 minutes / 默认15分钟
  })
  const [userGroups, setUserGroups] = useState<{id: number, name: string}[]>([])
  const [geoipStatus, setGeoipStatus] = useState<GeoIpStatus | null>(null)
  const [geoipDownloading, setGeoipDownloading] = useState<string | null>(null)
  const [geoipConfig, setGeoipConfig] = useState({
    enabled: false,
    url: 'https://git.io/GeoLite2-Country.mmdb',
    update_interval: 'weekly',
    last_update: null as string | null
  })
  const [versionInfo, setVersionInfo] = useState({
    backend_version: '',
    frontend_version: '',
    build_time: ''
  })
  const [intervalDropdownOpen, setIntervalDropdownOpen] = useState(false)
  const intervalDropdownRef = useRef<HTMLDivElement>(null)
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false)
  const groupDropdownRef = useRef<HTMLDivElement>(null)
  const geoipUrl = geoipConfig.url

  const intervalOptions = [
    { value: 'daily', label: t('settings.daily') },
    { value: 'weekly', label: t('settings.weekly') },
    { value: 'monthly', label: t('settings.monthly') }
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (intervalDropdownRef.current && !intervalDropdownRef.current.contains(e.target as Node)) {
        setIntervalDropdownOpen(false)
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadSettings()
    loadGeoipStatus()
    loadUserGroups()
    loadVersionInfo()
  }, [])

  const formatBuildTime = (utcTime: string) => {
    if (!utcTime) return ''
    try {
      // 解析UTC时间字符串 (格式: "2025-12-21 12:30:45 UTC")
      const cleanTime = utcTime.replace(' UTC', '')
      const date = new Date(cleanTime + 'Z')
      return date.toLocaleString()
    } catch {
      return utcTime
    }
  }

  const loadVersionInfo = async () => {
    try {
      const response = await api.get('/api/settings/version')
      if (response.data?.data) {
        setVersionInfo({
          backend_version: response.data.data.backend_version || '',
          frontend_version: '1.0.4',
          build_time: formatBuildTime(response.data.data.build_time)
        })
      }
    } catch {}
  }

  const loadUserGroups = async () => {
    try {
      const response = await api.get('/api/groups')
      if (Array.isArray(response.data)) {
        setUserGroups(response.data)
      } else if (response.data?.groups && Array.isArray(response.data.groups)) {
        setUserGroups(response.data.groups)
      }
    } catch {}
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          site_title: data.site_title || '',
          site_description: data.site_description || '',
          allow_registration: data.allow_registration || false,
          default_user_group: data.default_user_group || '',
          site_announcement: data.site_announcement || '',
          robots_txt: data.robots_txt || '',
          proxy_max_speed: data.proxy_max_speed || 0,
          proxy_max_concurrent: data.proxy_max_concurrent || 0,
          download_domain: data.download_domain || '',
          link_expiry_minutes: data.link_expiry_minutes || 15
        })
      }
    } catch (err) {
      toast.error(t('settings.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const loadGeoipStatus = async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        api.get('/api/settings/geoip/status'),
        api.get('/api/settings/geoip/config')
      ])
      console.log('GeoIP config response:', configRes.data)
      if (statusRes.data.code === 200) {
        setGeoipStatus(statusRes.data.data)
      }
      if (configRes.data.code === 200 && configRes.data.data) {
        setGeoipConfig(prev => ({
          ...prev,
          enabled: configRes.data.data.enabled ?? false,
          url: configRes.data.data.url || 'https://git.io/GeoLite2-Country.mmdb',
          update_interval: configRes.data.data.update_interval || 'weekly',
          last_update: configRes.data.data.last_update || null
        }))
      }
    } catch (err) {
      console.error('Failed to load GeoIP status', err)
    }
  }

  const handleDownloadGeoip = async (dbType: string) => {
    if (geoipDownloading) return
    
    setGeoipDownloading(dbType)
    try {
      const res = await api.post('/api/settings/geoip/download', {
        url: geoipUrl,
        db_type: dbType
      })
      if (res.data.code === 200) {
        toast.success(t('settings.downloadSuccess'))
        loadGeoipStatus()
      } else {
        toast.error(res.data.message || t('settings.downloadFailed'))
      }
    } catch (err) {
      toast.error(t('settings.downloadFailed'))
    } finally {
      setGeoipDownloading(null)
    }
  }

  const handleReloadGeoip = async () => {
    try {
      const res = await api.post('/api/settings/geoip/reload')
      if (res.data.code === 200) {
        toast.success(t('settings.reloadSuccess'))
        loadGeoipStatus()
      } else {
        toast.error(res.data.message || t('settings.loadFailed'))
      }
    } catch (err) {
      toast.error(t('settings.loadFailed'))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 保存基本设置
      const response = await api.post('/api/settings', settings)
      if (response.data.code !== 200) {
        toast.error(response.data.message || t('settings.saveFailed'))
        setSaving(false)
        return
      }
      
      // 同时保存GeoIP配置
      const geoipRes = await api.post('/api/settings/geoip/config', {
        enabled: geoipConfig.enabled,
        url: geoipConfig.url,
        update_interval: geoipConfig.update_interval
      })
      if (geoipRes.data.code !== 200) {
        toast.error(geoipRes.data.message || t('settings.geoipConfigSaveFailed'))
        setSaving(false)
        return
      }
      
      toast.success(t('settings.saveSuccess'))
    } catch (err) {
      toast.error(t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-page basic-settings">
        <div className="admin-page__loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin-page basic-settings">
      <AdminPageHeader title={t('settings.title')} />
      
      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.basicInfo')}</h2>
        
        <div className="basic-settings__version-info">
          <div className="basic-settings__version-item">
            <span className="basic-settings__version-label">{t('settings.backendVersion')}</span>
            <span className="basic-settings__version-value">{versionInfo.backend_version || '-'}</span>
          </div>
          <div className="basic-settings__version-item">
            <span className="basic-settings__version-label">{t('settings.frontendVersion')}</span>
            <span className="basic-settings__version-value">{versionInfo.frontend_version || '-'}</span>
          </div>
          <div className="basic-settings__version-item">
            <span className="basic-settings__version-label">{t('settings.buildTime')}</span>
            <span className="basic-settings__version-value">{versionInfo.build_time || '-'}</span>
          </div>
        </div>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.siteTitle')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.site_title}
            onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
            placeholder={t('settings.siteTitlePlaceholder')}
          />
          <p className="basic-settings__hint">{t('settings.siteTitleHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.siteDescription')}</label>
          <textarea
            className="basic-settings__textarea"
            value={settings.site_description}
            onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
            placeholder={t('settings.siteDescriptionPlaceholder')}
            rows={3}
          />
          <p className="basic-settings__hint">{t('settings.siteDescriptionHint')}</p>
        </div>
      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.userSettings')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">
            <input
              type="checkbox"
              checked={settings.allow_registration}
              onChange={(e) => setSettings({ ...settings, allow_registration: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            {t('settings.allowRegistration')}
          </label>
          <p className="basic-settings__hint">{t('settings.allowRegistrationHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.defaultUserGroup')}</label>
          <div className="basic-settings__custom-select" ref={groupDropdownRef}>
            <div 
              className={`basic-settings__select-trigger ${groupDropdownOpen ? 'basic-settings__select-trigger--open' : ''}`}
              onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
            >
              <span>{userGroups.find(g => String(g.id) === settings.default_user_group)?.name || t('settings.selectUserGroup')}</span>
              <ChevronDown size={16} className={`basic-settings__select-arrow ${groupDropdownOpen ? 'basic-settings__select-arrow--open' : ''}`} />
            </div>
            <div className={`basic-settings__select-dropdown ${groupDropdownOpen ? 'basic-settings__select-dropdown--open' : ''}`}>
              {userGroups.map(group => (
                <div
                  key={group.id}
                  className={`basic-settings__select-option ${String(group.id) === settings.default_user_group ? 'basic-settings__select-option--selected' : ''}`}
                  onClick={() => {
                    setSettings({ ...settings, default_user_group: String(group.id) })
                    setGroupDropdownOpen(false)
                  }}
                >
                  {group.name}
                </div>
              ))}
            </div>
          </div>
          <p className="basic-settings__hint">{t('settings.defaultUserGroupHint')}</p>
        </div>
      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.announcement')}</h2>
        
        <div className="basic-settings__field">
          <textarea
            className="basic-settings__textarea"
            value={settings.site_announcement}
            onChange={(e) => setSettings({ ...settings, site_announcement: e.target.value })}
            placeholder={t('settings.announcementPlaceholder')}
            rows={3}
          />
          <p className="basic-settings__hint">{t('settings.announcementHint')}</p>
        </div>
      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.robotsTxt')}</h2>
        
        <div className="basic-settings__field">
          <textarea
            className="basic-settings__textarea"
            value={settings.robots_txt}
            onChange={(e) => setSettings({ ...settings, robots_txt: e.target.value })}
            placeholder={t('settings.robotsTxtPlaceholder')}
            rows={6}
          />
          <p className="basic-settings__hint">{t('settings.robotsTxtHint')}</p>
        </div>
      </div>

      {/* Proxy and Download Settings / 代理和下载设置 */}
      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.proxySettings')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.proxyMaxSpeed')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              className="basic-settings__input"
              style={{ width: '150px' }}
              value={settings.proxy_max_speed === 0 ? '' : Math.floor(settings.proxy_max_speed / 1024 / 1024)}
              onChange={(e) => {
                const mbps = parseInt(e.target.value) || 0
                setSettings({ ...settings, proxy_max_speed: mbps * 1024 * 1024 })
              }}
              placeholder="0"
              min="0"
            />
            <span>MB/s</span>
          </div>
          <p className="basic-settings__hint">{t('settings.proxyMaxSpeedHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.proxyMaxConcurrent')}</label>
          <input
            type="number"
            className="basic-settings__input"
            style={{ width: '150px' }}
            value={settings.proxy_max_concurrent === 0 ? '' : settings.proxy_max_concurrent}
            onChange={(e) => setSettings({ ...settings, proxy_max_concurrent: parseInt(e.target.value) || 0 })}
            placeholder="0"
            min="0"
          />
          <p className="basic-settings__hint">{t('settings.proxyMaxConcurrentHint')}</p>
        </div>
      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.downloadDomainSettings')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.downloadDomain')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.download_domain}
            onChange={(e) => setSettings({ ...settings, download_domain: e.target.value })}
            placeholder="dl.example.com"
          />
          <p className="basic-settings__hint">{t('settings.downloadDomainHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.linkExpiryMinutes')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              className="basic-settings__input"
              style={{ width: '150px' }}
              value={settings.link_expiry_minutes}
              onChange={(e) => setSettings({ ...settings, link_expiry_minutes: parseInt(e.target.value) || 15 })}
              placeholder="15"
              min="1"
            />
            <span>{t('settings.minutes')}</span>
          </div>
          <p className="basic-settings__hint">{t('settings.linkExpiryMinutesHint')}</p>
        </div>

      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.geoipDatabase')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">
            <input
              type="checkbox"
              checked={geoipConfig.enabled}
              onChange={(e) => setGeoipConfig({ ...geoipConfig, enabled: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            {t('settings.enableAutoUpdate')}
          </label>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.updateInterval')}</label>
          <div className="basic-settings__custom-select" ref={intervalDropdownRef}>
            <div 
              className={`basic-settings__select-trigger ${intervalDropdownOpen ? 'basic-settings__select-trigger--open' : ''}`}
              onClick={() => setIntervalDropdownOpen(!intervalDropdownOpen)}
            >
              <span>{intervalOptions.find(o => o.value === geoipConfig.update_interval)?.label || t('settings.weekly')}</span>
              <ChevronDown size={16} className={`basic-settings__select-arrow ${intervalDropdownOpen ? 'basic-settings__select-arrow--open' : ''}`} />
            </div>
            <div className={`basic-settings__select-dropdown ${intervalDropdownOpen ? 'basic-settings__select-dropdown--open' : ''}`}>
              {intervalOptions.map(option => (
                <div
                  key={option.value}
                  className={`basic-settings__select-option ${geoipConfig.update_interval === option.value ? 'basic-settings__select-option--selected' : ''}`}
                  onClick={() => {
                    setGeoipConfig({ ...geoipConfig, update_interval: option.value })
                    setIntervalDropdownOpen(false)
                  }}
                >
                  {option.label}
                  {geoipConfig.update_interval === option.value && <Check size={14} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.databaseUrl')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={geoipConfig.url}
            onChange={(e) => setGeoipConfig({ ...geoipConfig, url: e.target.value })}
            placeholder="https://git.io/GeoLite2-Country.mmdb"
          />
          <p className="basic-settings__hint">
            {t('settings.databaseUrlHint')}
          </p>
        </div>

        {geoipConfig.last_update && (
          <p className="basic-settings__hint" style={{ marginBottom: '16px' }}>
            {t('settings.lastUpdate')}: {new Date(geoipConfig.last_update).toLocaleString()}
          </p>
        )}

        <div className="basic-settings__geoip-status">
          <div className="basic-settings__geoip-item">
            <div className="basic-settings__geoip-info">
              <span className="basic-settings__geoip-name">{t('settings.countryDatabase')}</span>
              <span className={`basic-settings__geoip-badge ${geoipStatus?.country_db ? 'basic-settings__geoip-badge--success' : 'basic-settings__geoip-badge--error'}`}>
                {geoipStatus?.country_db ? <><Check size={12} /> {t('settings.installed')}</> : <><X size={12} /> {t('settings.notInstalled')}</>}
              </span>
            </div>
            <button
              className="basic-settings__btn basic-settings__btn--small"
              onClick={() => handleDownloadGeoip('country')}
              disabled={geoipDownloading === 'country'}
            >
              {geoipDownloading === 'country' ? <><RefreshCw size={14} className="spin" /> {t('settings.downloading')}</> : <><Download size={14} /> {t('common.download')}</>}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            className="basic-settings__btn basic-settings__btn--secondary"
            onClick={handleReloadGeoip}
          >
            <RefreshCw size={14} /> {t('settings.reloadDatabase')}
          </button>
        </div>
      </div>

      <div className="basic-settings__actions">
        <button 
          className="basic-settings__btn basic-settings__btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('settings.saving') : t('settings.saveSettings')}
        </button>
      </div>
    </div>
  )
}
