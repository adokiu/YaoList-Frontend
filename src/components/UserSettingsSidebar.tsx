import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, Phone, Shield, Key, Lock, ChevronRight, Check, Eye, EyeOff, Loader2, Settings, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import '../styles/components/user-settings-sidebar.scss'
import { lockPageScroll } from '../utils/scrollLock'

interface UserInfo {
  id: string
  username: string
  email: string
  phone: string
  avatar?: string
  two_factor_enabled: boolean
  created_at: string
  total_requests?: number
  total_traffic?: number
}

// 格式化数字（请求数）
const formatNumber = (num: number): string => {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

// 格式化流量（字节）
const formatTraffic = (bytes: number): string => {
  if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(2) + ' TB'
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

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

interface UserSettingsSidebarProps {
  visible: boolean
  onClose: () => void
  permissions: UserPermissions | null
}

type EditMode = 'none' | 'email' | 'phone' | 'password' | '2fa-setup' | '2fa-disable'

export default function UserSettingsSidebar({ visible, onClose, permissions }: UserSettingsSidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState<EditMode>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isClosing, setIsClosing] = useState(false) // 关闭动画状态
  const [shouldRender, setShouldRender] = useState(false) // 是否应该渲染
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  
  // 编辑表单状态
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  // 修改密码
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  
  // 2FA
  const [twoFASecret, setTwoFASecret] = useState('')
  const [twoFAQrCode, setTwoFAQrCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [setting2FA, setSetting2FA] = useState(false)

  // 处理打开/关闭动画
  useEffect(() => {
    if (visible) {
      setShouldRender(true)
      setIsClosing(false)
    } else if (shouldRender) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 200) // 与动画时间一致
      return () => clearTimeout(timer)
    }
  }, [visible])

  useEffect(() => {
    if (visible) {
      loadUserInfo()
    }
  }, [visible])

  // 侧栏挂载期间锁定 html 滚动 + 底层 inert（含关闭动画）；Esc 关闭
  useEffect(() => {
    if (!shouldRender) return

    const unlock = lockPageScroll({
      allowScrollSelector: '.user-settings-sidebar__content',
      inertRoot: true
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlock()
    }
  }, [shouldRender])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const loadUserInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUserInfo(data)
      }
    } catch (err) {
      console.error('Failed to load user info:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCaptcha = async () => {
    try {
      const response = await fetch('/api/auth/captcha')
      if (response.ok) {
        const data = await response.json()
        setCaptchaId(data.captcha_id)
        setCaptchaImage(data.captcha_image)
      }
    } catch (err) {
      console.error('Failed to load captcha:', err)
    }
  }

  const handleEditEmail = () => {
    setEditMode('email')
    setNewEmail(userInfo?.email || '')
    setVerificationCode('')
    setCaptchaCode('')
    setError('')
    setSuccess('')
    loadCaptcha()
  }

  const handleEditPhone = () => {
    setEditMode('phone')
    setNewPhone(userInfo?.phone || '')
    setVerificationCode('')
    setCaptchaCode('')
    setError('')
    setSuccess('')
    loadCaptcha()
  }

  const handleEditPassword = () => {
    setEditMode('password')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
  }

  const handleCancel = () => {
    setEditMode('none')
    setError('')
    setSuccess('')
  }

  const sendVerificationCode = async (type: 'email' | 'phone') => {
    if (!captchaCode) {
      setError(t('userSettings.enterCaptcha'))
      return
    }
    
    setSendingCode(true)
    setError('')
    try {
      const target = type === 'email' ? newEmail : newPhone
      const response = await fetch('/api/notifications/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: type === 'email' ? 'email' : 'sms',
          target,
          captcha_id: captchaId,
          captcha_code: captchaCode
        })
      })
      const data = await response.json()
      if (data.code === 200) {
        setCountdown(60)
        setSuccess(t('userSettings.codeSent'))
      } else {
        setError(data.message || t('userSettings.sendFailed'))
        loadCaptcha()
      }
    } catch (err) {
      setError(t('userSettings.sendFailed'))
      loadCaptcha()
    } finally {
      setSendingCode(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!newEmail) {
      setError(t('userSettings.enterEmail'))
      return
    }
    if (!verificationCode) {
      setError(t('userSettings.enterVerificationCode'))
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/auth/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newEmail,
          verification_code: verificationCode
        })
      })
      const data = await response.json()
      if (data.code === 200 || response.ok) {
        setSuccess(t('userSettings.emailUpdated'))
        setEditMode('none')
        loadUserInfo()
      } else {
        setError(data.error || data.message || t('userSettings.updateFailed'))
      }
    } catch (err) {
      setError(t('userSettings.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePhone = async () => {
    if (!newPhone) {
      setError(t('userSettings.enterPhone'))
      return
    }
    if (!verificationCode) {
      setError(t('userSettings.enterVerificationCode'))
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/auth/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: newPhone,
          verification_code: verificationCode
        })
      })
      const data = await response.json()
      if (data.code === 200 || response.ok) {
        setSuccess(t('userSettings.phoneUpdated'))
        setEditMode('none')
        loadUserInfo()
      } else {
        setError(data.error || data.message || t('userSettings.updateFailed'))
      }
    } catch (err) {
      setError(t('userSettings.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async () => {
    if (!currentPassword) {
      setError(t('userSettings.enterCurrentPassword'))
      return
    }
    if (!newPassword) {
      setError(t('userSettings.enterNewPassword'))
      return
    }
    if (newPassword.length < 6) {
      setError(t('userSettings.passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('userSettings.passwordMismatch'))
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })
      const data = await response.json()
      if (data.code === 200 || response.ok) {
        setSuccess(t('userSettings.passwordUpdated'))
        setEditMode('none')
      } else {
        setError(data.error || data.message || t('userSettings.updateFailed'))
      }
    } catch (err) {
      setError(t('userSettings.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle2FA = async () => {
    if (userInfo?.two_factor_enabled) {
      // 关闭2FA
      setEditMode('2fa-disable')
      setTotpCode('')
      setError('')
      setSuccess('')
    } else {
      // 开启2FA - 先获取二维码
      setSetting2FA(true)
      setError('')
      try {
        const response = await fetch('/api/auth/2fa/setup', {
          method: 'POST',
          credentials: 'include'
        })
        const data = await response.json()
        if (data.code === 200) {
          setTwoFASecret(data.secret)
          setTwoFAQrCode(data.qr_code)
          setEditMode('2fa-setup')
          setTotpCode('')
        } else {
          setError(data.error || t('userSettings.setupFailed'))
        }
      } catch (err) {
        setError(t('userSettings.setupFailed'))
      } finally {
        setSetting2FA(false)
      }
    }
  }

  const handleEnable2FA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError(t('userSettings.enterTotpCode'))
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totp_code: totpCode })
      })
      const data = await response.json()
      if (data.code === 200 || response.ok) {
        setSuccess(t('userSettings.twoFactorEnabled'))
        setEditMode('none')
        loadUserInfo()
      } else {
        setError(data.error || t('userSettings.verifyFailed'))
      }
    } catch (err) {
      setError(t('userSettings.verifyFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError(t('userSettings.enterTotpCode'))
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totp_code: totpCode })
      })
      const data = await response.json()
      if (data.code === 200 || response.ok) {
        setSuccess(t('userSettings.twoFactorDisabled'))
        setEditMode('none')
        loadUserInfo()
      } else {
        setError(data.error || t('userSettings.verifyFailed'))
      }
    } catch (err) {
      setError(t('userSettings.verifyFailed'))
    } finally {
      setSaving(false)
    }
  }

  const permissionLabels: Record<string, string> = {
    read_files: t('userSettings.permissions.readFiles'),
    create_upload: t('userSettings.permissions.createUpload'),
    rename_files: t('userSettings.permissions.renameFiles'),
    move_files: t('userSettings.permissions.moveFiles'),
    copy_files: t('userSettings.permissions.copyFiles'),
    delete_files: t('userSettings.permissions.deleteFiles'),
    allow_direct_link: t('userSettings.permissions.allowDirectLink'),
    allow_share: t('userSettings.permissions.allowShare'),
    extract_files: t('userSettings.permissions.extractFiles'),
    is_admin: t('userSettings.permissions.isAdmin')
  }

  if (!shouldRender) return null

  return createPortal(
    <div className="user-settings-sidebar-portal">
      <div
        className={`user-settings-sidebar__backdrop ${isClosing ? 'user-settings-sidebar__backdrop--closing' : ''}`}
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <div
        className={`user-settings-sidebar ${isClosing ? 'user-settings-sidebar--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-settings-sidebar-title"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="user-settings-sidebar__header">
        <h3 id="user-settings-sidebar-title">{t('userSettings.title')}</h3>
        <button type="button" className="user-settings-sidebar__close" onClick={onClose} aria-label={t('common.close', '关闭')}>
          <X size={18} />
        </button>
      </div>

      <div className="user-settings-sidebar__content">
        {loading ? (
          <div className="user-settings-sidebar__loading">
            <Loader2 size={24} className="spinning" />
          </div>
        ) : (
          <>
            {/* 账号信息卡片 */}
            <div className="user-settings-sidebar__card">
              {/* 用户名 */}
              <div className="user-settings-sidebar__row">
                <div className="user-settings-sidebar__row-label">{t('userSettings.basicInfo')}</div>
                <div className="user-settings-sidebar__row-value">{userInfo?.username || '—'}</div>
              </div>

              {/* 邮箱 */}
              {editMode === 'email' ? (
                <div className="user-settings-sidebar__edit-form">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t('userSettings.enterEmail')}
                    className="user-settings-sidebar__input"
                  />
                  <div className="user-settings-sidebar__captcha-row">
                    <input
                      type="text"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value)}
                      placeholder={t('userSettings.enterCaptcha')}
                      className="user-settings-sidebar__input user-settings-sidebar__input--captcha"
                    />
                    <img 
                      src={captchaImage} 
                      alt="captcha" 
                      className="user-settings-sidebar__captcha-image"
                      onClick={loadCaptcha}
                    />
                  </div>
                  <div className="user-settings-sidebar__code-row">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder={t('userSettings.enterVerificationCode')}
                      className="user-settings-sidebar__input"
                    />
                    <button
                      className="user-settings-sidebar__send-btn"
                      onClick={() => sendVerificationCode('email')}
                      disabled={sendingCode || countdown > 0}
                    >
                      {countdown > 0 ? `${countdown}s` : sendingCode ? <Loader2 size={14} className="spinning" /> : t('userSettings.sendCode')}
                    </button>
                  </div>
                  {error && <div className="user-settings-sidebar__error">{error}</div>}
                  {success && <div className="user-settings-sidebar__success">{success}</div>}
                  <div className="user-settings-sidebar__form-actions">
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--cancel" onClick={handleCancel}>
                      {t('userSettings.cancel')}
                    </button>
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--save" onClick={handleSaveEmail} disabled={saving}>
                      {saving ? <Loader2 size={14} className="spinning" /> : t('userSettings.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="user-settings-sidebar__row user-settings-sidebar__row--clickable" onClick={handleEditEmail}>
                  <div className="user-settings-sidebar__row-label">
                    <Mail size={14} />
                    {t('userSettings.email')}
                  </div>
                  <div className="user-settings-sidebar__row-value">
                    {userInfo?.email || t('userSettings.notSet')}
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}

              {/* 手机号 */}
              {editMode === 'phone' ? (
                <div className="user-settings-sidebar__edit-form">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder={t('userSettings.enterPhone')}
                    className="user-settings-sidebar__input"
                  />
                  <div className="user-settings-sidebar__captcha-row">
                    <input
                      type="text"
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value)}
                      placeholder={t('userSettings.enterCaptcha')}
                      className="user-settings-sidebar__input user-settings-sidebar__input--captcha"
                    />
                    <img 
                      src={captchaImage} 
                      alt="captcha" 
                      className="user-settings-sidebar__captcha-image"
                      onClick={loadCaptcha}
                    />
                  </div>
                  <div className="user-settings-sidebar__code-row">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder={t('userSettings.enterVerificationCode')}
                      className="user-settings-sidebar__input"
                    />
                    <button
                      className="user-settings-sidebar__send-btn"
                      onClick={() => sendVerificationCode('phone')}
                      disabled={sendingCode || countdown > 0}
                    >
                      {countdown > 0 ? `${countdown}s` : sendingCode ? <Loader2 size={14} className="spinning" /> : t('userSettings.sendCode')}
                    </button>
                  </div>
                  {error && <div className="user-settings-sidebar__error">{error}</div>}
                  {success && <div className="user-settings-sidebar__success">{success}</div>}
                  <div className="user-settings-sidebar__form-actions">
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--cancel" onClick={handleCancel}>
                      {t('userSettings.cancel')}
                    </button>
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--save" onClick={handleSavePhone} disabled={saving}>
                      {saving ? <Loader2 size={14} className="spinning" /> : t('userSettings.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="user-settings-sidebar__row user-settings-sidebar__row--clickable" onClick={handleEditPhone}>
                  <div className="user-settings-sidebar__row-label">
                    <Phone size={14} />
                    {t('userSettings.phone')}
                  </div>
                  <div className="user-settings-sidebar__row-value">
                    {userInfo?.phone || t('userSettings.notSet')}
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}

              {/* 密码 */}
              {editMode === 'password' ? (
                <div className="user-settings-sidebar__edit-form">
                  <div className="user-settings-sidebar__password-row">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('userSettings.currentPassword')}
                      className="user-settings-sidebar__input"
                    />
                    <button 
                      className="user-settings-sidebar__eye-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="user-settings-sidebar__password-row">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('userSettings.newPassword')}
                      className="user-settings-sidebar__input"
                    />
                    <button 
                      className="user-settings-sidebar__eye-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('userSettings.confirmPassword')}
                    className="user-settings-sidebar__input"
                  />
                  {error && <div className="user-settings-sidebar__error">{error}</div>}
                  {success && <div className="user-settings-sidebar__success">{success}</div>}
                  <div className="user-settings-sidebar__form-actions">
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--cancel" onClick={handleCancel}>
                      {t('userSettings.cancel')}
                    </button>
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--save" onClick={handleSavePassword} disabled={saving}>
                      {saving ? <Loader2 size={14} className="spinning" /> : t('userSettings.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="user-settings-sidebar__row user-settings-sidebar__row--clickable" onClick={handleEditPassword}>
                  <div className="user-settings-sidebar__row-label">
                    <Key size={14} />
                    {t('userSettings.password')}
                  </div>
                  <div className="user-settings-sidebar__row-value">
                    ••••••••
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}

              {/* 2FA */}
              {editMode === '2fa-setup' ? (
                <div className="user-settings-sidebar__edit-form user-settings-sidebar__2fa-setup">
                  <div className="user-settings-sidebar__2fa-title">
                    <Shield size={16} />
                    {t('userSettings.setup2FA')}
                  </div>
                  <div className="user-settings-sidebar__2fa-qr">
                    <img src={twoFAQrCode} alt="2FA QR Code" />
                  </div>
                  <div className="user-settings-sidebar__2fa-secret">
                    <span>{t('userSettings.secretKey')}:</span>
                    <code>{twoFASecret}</code>
                  </div>
                  <div className="user-settings-sidebar__2fa-hint">
                    {t('userSettings.scan2FAHint')}
                  </div>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('userSettings.enterTotpCode')}
                    className="user-settings-sidebar__input user-settings-sidebar__input--center"
                    maxLength={6}
                  />
                  {error && <div className="user-settings-sidebar__error">{error}</div>}
                  {success && <div className="user-settings-sidebar__success">{success}</div>}
                  <div className="user-settings-sidebar__form-actions">
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--cancel" onClick={handleCancel}>
                      {t('userSettings.cancel')}
                    </button>
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--save" onClick={handleEnable2FA} disabled={saving}>
                      {saving ? <Loader2 size={14} className="spinning" /> : t('userSettings.enable')}
                    </button>
                  </div>
                </div>
              ) : editMode === '2fa-disable' ? (
                <div className="user-settings-sidebar__edit-form">
                  <div className="user-settings-sidebar__2fa-title">
                    <Shield size={16} />
                    {t('userSettings.disable2FA')}
                  </div>
                  <div className="user-settings-sidebar__2fa-hint">
                    {t('userSettings.disable2FAHint')}
                  </div>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('userSettings.enterTotpCode')}
                    className="user-settings-sidebar__input user-settings-sidebar__input--center"
                    maxLength={6}
                  />
                  {error && <div className="user-settings-sidebar__error">{error}</div>}
                  {success && <div className="user-settings-sidebar__success">{success}</div>}
                  <div className="user-settings-sidebar__form-actions">
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--cancel" onClick={handleCancel}>
                      {t('userSettings.cancel')}
                    </button>
                    <button className="user-settings-sidebar__btn user-settings-sidebar__btn--save" onClick={handleDisable2FA} disabled={saving}>
                      {saving ? <Loader2 size={14} className="spinning" /> : t('userSettings.disable')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="user-settings-sidebar__row user-settings-sidebar__row--clickable" onClick={handleToggle2FA}>
                  <div className="user-settings-sidebar__row-label">
                    <Shield size={14} />
                    {t('userSettings.twoFactor')}
                    {setting2FA && <Loader2 size={14} className="spinning" style={{marginLeft: 8}} />}
                  </div>
                  <div className="user-settings-sidebar__row-value">
                    <div className={`user-settings-sidebar__toggle ${userInfo?.two_factor_enabled ? 'active' : ''}`}>
                      <div className="user-settings-sidebar__toggle-dot"></div>
                    </div>
                  </div>
                </div>
              )}
              {error && editMode === 'none' && <div className="user-settings-sidebar__error" style={{padding: '0 12px 12px'}}>{error}</div>}
            </div>

            {/* 使用统计 */}
            <div className="user-settings-sidebar__section">
              <div className="user-settings-sidebar__section-title">
                <Shield size={16} />
                {t('userSettings.usageStats')}
              </div>
              <div className="user-settings-sidebar__stats">
                <div className="user-settings-sidebar__stat-item">
                  <span className="user-settings-sidebar__stat-label">{t('userSettings.requestCount')}</span>
                  <span className="user-settings-sidebar__stat-value">{formatNumber(userInfo?.total_requests || 0)}</span>
                </div>
                <div className="user-settings-sidebar__stat-item">
                  <span className="user-settings-sidebar__stat-label">{t('userSettings.trafficUsed')}</span>
                  <span className="user-settings-sidebar__stat-value">{formatTraffic(userInfo?.total_traffic || 0)}</span>
                </div>
              </div>
            </div>

            {/* 权限列表 */}
            <div className="user-settings-sidebar__section">
              <div className="user-settings-sidebar__section-title">
                <Lock size={16} />
                {t('userSettings.myPermissions')}
              </div>
              <div className="user-settings-sidebar__permissions">
                {permissions && Object.entries(permissions)
                  .filter(([_, value]) => value)
                  .map(([key]) => (
                    <span 
                      key={key} 
                      className={`user-settings-sidebar__permission-tag ${key === 'is_admin' ? 'user-settings-sidebar__permission-tag--admin' : ''}`}
                    >
                      <Check size={12} />
                      {permissionLabels[key] || key}
                    </span>
                  ))}
              </div>
            </div>

            {/* 管理后台入口 - 仅管理员可见 */}
            {permissions?.is_admin && (
              <div className="user-settings-sidebar__section">
                <button 
                  className="user-settings-sidebar__admin-btn"
                  onClick={() => navigate('/manage')}
                >
                  <Settings size={18} />
                  {t('userSettings.goToAdmin')}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* 退出登录 */}
            <div className="user-settings-sidebar__section">
              <button 
                className="user-settings-sidebar__logout-btn"
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                  } finally {
                    window.location.href = '/login'
                  }
                }}
              >
                <LogOut size={18} />
                {t('userSettings.logout', '退出登录')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </div>,
    document.body
  )
}
