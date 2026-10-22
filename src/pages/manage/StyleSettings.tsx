import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/basic-settings.scss'

export default function StyleSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    site_icon: '',
    background_image: '',
    glass_effect: false
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          site_icon: data.site_icon || '',
          background_image: data.background_image || '',
          glass_effect: !!data.glass_effect
        })
      }
    } catch (err) {
      toast.error(t('settings.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.post('/api/settings', settings)
      if (response.data.code === 200) {
        toast.success(t('settings.saveSuccess'))
      } else {
        toast.error(response.data.message || t('settings.saveFailed'))
      }
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
      <AdminPageHeader title={t('settings.styleTitle')} />
      
      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.siteIcon')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.siteIconUrl')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.site_icon}
            onChange={(e) => setSettings({ ...settings, site_icon: e.target.value })}
            placeholder={t('settings.siteIconPlaceholder')}
          />
          <p className="basic-settings__hint">{t('settings.siteIconHint')}</p>
        </div>

      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.backgroundImage')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('settings.backgroundImageUrl')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.background_image}
            onChange={(e) => setSettings({ ...settings, background_image: e.target.value })}
            placeholder={t('settings.backgroundImagePlaceholder')}
          />
          <p className="basic-settings__hint">{t('settings.backgroundImageHint')}</p>
        </div>

      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('settings.glassEffect')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              checked={settings.glass_effect}
              onChange={(e) => setSettings({ ...settings, glass_effect: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            {t('settings.enableGlassEffect')}
          </label>
          <p className="basic-settings__hint">{t('settings.glassEffectHint')}</p>
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
