import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/basic-settings.scss'

export default function PreviewSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    preview_encrypted_audio: false
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
          preview_encrypted_audio: data.preview_encrypted_audio || false
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
      <AdminPageHeader title={t('settings.previewTitle')} />
      
      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('preview.audioPreview')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label">
            <input
              type="checkbox"
              checked={settings.preview_encrypted_audio}
              onChange={(e) => setSettings({ ...settings, preview_encrypted_audio: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            {t('preview.allowEncryptedAudio')}
          </label>
          <p className="basic-settings__hint" style={{ color: 'var(--warning)' }}>
            {t('preview.encryptedAudioHint')}
          </p>
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
