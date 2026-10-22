import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/basic-settings.scss'

interface NotificationSettings {
  email_enabled: boolean
  email_host: string
  email_port: number
  email_username: string
  email_password: string
  email_from_email: string
  email_from_name: string
  email_use_tls: boolean
  sms_enabled: boolean
  sms_access_key_id: string
  sms_access_key_secret: string
  sms_sign_name: string
  sms_template_code: string
}

const defaultSettings: NotificationSettings = {
  email_enabled: false,
  email_host: '',
  email_port: 465,
  email_username: '',
  email_password: '',
  email_from_email: '',
  email_from_name: 'YaoList',
  email_use_tls: true,
  sms_enabled: false,
  sms_access_key_id: '',
  sms_access_key_secret: '',
  sms_sign_name: '',
  sms_template_code: ''
}

export default function Notifications() {
  const { t } = useTranslation()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingSms, setTestingSms] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/notifications/settings')
      if (res.data.code === 200 && res.data.data) {
        setSettings({ ...defaultSettings, ...res.data.data })
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.post('/api/notifications/settings', settings)
      if (res.data.code === 200) {
        toast.success(t('notifications.saveSuccess'))
      } else {
        toast.error(res.data.message || t('notifications.saveFailed'))
      }
    } catch (err) {
      toast.error(t('notifications.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error(t('notifications.enterTestEmail'))
      return
    }
    setTestingEmail(true)
    try {
      const res = await api.post('/api/notifications/test/email', { target: testEmail })
      if (res.data.code === 200) {
        toast.success(res.data.message || t('notifications.testEmailSuccess'))
      } else {
        toast.error(res.data.message || t('notifications.testEmailFailed'))
      }
    } catch (err) {
      toast.error(t('notifications.testEmailFailed'))
    } finally {
      setTestingEmail(false)
    }
  }

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error(t('notifications.enterTestPhone'))
      return
    }
    setTestingSms(true)
    try {
      const res = await api.post('/api/notifications/test/sms', { target: testPhone })
      if (res.data.code === 200) {
        toast.success(res.data.message || t('notifications.testSmsSuccess'))
      } else {
        toast.error(res.data.message || t('notifications.testSmsFailed'))
      }
    } catch (err) {
      toast.error(t('notifications.testSmsFailed'))
    } finally {
      setTestingSms(false)
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
      <AdminPageHeader title={t('notifications.title')} />
      
      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('notifications.emailSection')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              checked={settings.email_enabled}
              onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            {t('notifications.enableEmail')}
          </label>
          <p className="basic-settings__hint">{t('notifications.enableEmailHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.smtpServer')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.email_host}
            onChange={(e) => setSettings({ ...settings, email_host: e.target.value })}
            placeholder="smtp.example.com"
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.port')}</label>
          <input
            type="number"
            className="basic-settings__input"
            value={settings.email_port}
            onChange={(e) => setSettings({ ...settings, email_port: parseInt(e.target.value) || 465 })}
            placeholder="465"
            style={{ width: '120px' }}
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.username')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.email_username}
            onChange={(e) => setSettings({ ...settings, email_username: e.target.value })}
            placeholder="your@email.com"
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.password')}</label>
          <input
            type="password"
            className="basic-settings__input"
            value={settings.email_password}
            onChange={(e) => setSettings({ ...settings, email_password: e.target.value })}
            placeholder={t('notifications.passwordPlaceholder')}
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.senderEmail')}</label>
          <input
            type="email"
            className="basic-settings__input"
            value={settings.email_from_email}
            onChange={(e) => setSettings({ ...settings, email_from_email: e.target.value })}
            placeholder="noreply@example.com"
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.senderName')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.email_from_name}
            onChange={(e) => setSettings({ ...settings, email_from_name: e.target.value })}
            placeholder="YaoList"
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              checked={settings.email_use_tls}
              onChange={(e) => setSettings({ ...settings, email_use_tls: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            {t('notifications.useTls')}
          </label>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.testSend')}</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="email"
              className="basic-settings__input"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t('notifications.testEmailPlaceholder')}
              style={{ flex: 1 }}
            />
            <button
              className="basic-settings__btn"
              onClick={handleTestEmail}
              disabled={testingEmail}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Send size={16} />
              {testingEmail ? t('notifications.sending') : t('notifications.sendTest')}
            </button>
          </div>
        </div>
      </div>

      <div className="basic-settings__section">
        <h2 className="basic-settings__section-title">{t('notifications.smsSection')}</h2>
        
        <div className="basic-settings__field">
          <label className="basic-settings__label" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="checkbox"
              checked={settings.sms_enabled}
              onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            {t('notifications.enableSms')}
          </label>
          <p className="basic-settings__hint">{t('notifications.enableSmsHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">AccessKey ID</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.sms_access_key_id}
            onChange={(e) => setSettings({ ...settings, sms_access_key_id: e.target.value })}
            placeholder="LTAI..."
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">AccessKey Secret</label>
          <input
            type="password"
            className="basic-settings__input"
            value={settings.sms_access_key_secret}
            onChange={(e) => setSettings({ ...settings, sms_access_key_secret: e.target.value })}
            placeholder="AccessKey Secret"
          />
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.smsSign')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.sms_sign_name}
            onChange={(e) => setSettings({ ...settings, sms_sign_name: e.target.value })}
            placeholder={t('notifications.smsSignPlaceholder')}
          />
          <p className="basic-settings__hint">{t('notifications.smsSignHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.templateCode')}</label>
          <input
            type="text"
            className="basic-settings__input"
            value={settings.sms_template_code}
            onChange={(e) => setSettings({ ...settings, sms_template_code: e.target.value })}
            placeholder="SMS_123456789"
          />
          <p className="basic-settings__hint">{t('notifications.templateCodeHint')}</p>
        </div>

        <div className="basic-settings__field">
          <label className="basic-settings__label">{t('notifications.testSend')}</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="tel"
              className="basic-settings__input"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder={t('notifications.testPhonePlaceholder')}
              style={{ flex: 1 }}
            />
            <button
              className="basic-settings__btn"
              onClick={handleTestSms}
              disabled={testingSms}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Send size={16} />
              {testingSms ? t('notifications.sending') : t('notifications.sendTest')}
            </button>
          </div>
        </div>
      </div>

      <div className="basic-settings__actions">
        <button 
          className="basic-settings__btn basic-settings__btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('notifications.saving') : t('notifications.save')}
        </button>
      </div>
    </div>
  )
}
