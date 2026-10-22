import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react'
import { api } from '../../utils/api'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/components/backup-restore.scss'

interface LogItem {
  type: 'success' | 'error' | 'info'
  message: string
}

export default function Backup() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [overrideExisting, setOverrideExisting] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appendLog = (message: string, type: LogItem['type']) => {
    setLogs(prev => [...prev, { type, message }])
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    }, 50)
  }

  const clearLogs = () => {
    setLogs([])
  }

  const handleBackup = async () => {
    clearLogs()
    setBackupLoading(true)
    appendLog(t('backup.startBackup'), 'info')

    try {
      const response = await api.get('/api/admin/backup')
      if (response.data.code === 200) {
        const backupData = response.data.data
        
        appendLog(`${t('backup.siteSettings')}: ${backupData.site_settings?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.users')}: ${backupData.users?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.userGroups')}: ${backupData.user_groups?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.userGroupMembers')}: ${backupData.user_group_members?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.drivers')}: ${backupData.drivers?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.mounts')}: ${backupData.mounts?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.metas')}: ${backupData.metas?.length || 0} ${t('backup.items')}`, 'success')
        appendLog(`${t('backup.shares')}: ${backupData.shares?.length || 0} ${t('backup.items')}`, 'success')
        
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `yaolist_backup_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        appendLog(t('backup.backupComplete'), 'info')
      } else {
        appendLog(`${t('backup.backupFailed')}: ${response.data.error || t('backup.unknown')}`, 'error')
      }
    } catch (error: any) {
      appendLog(`${t('backup.backupFailed')}: ${error.message || t('backup.networkError')}`, 'error')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestore = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    clearLogs()
    setRestoreLoading(true)
    appendLog(t('backup.startRestore'), 'info')
    appendLog(`${t('backup.readingFile')}: ${file.name}`, 'info')

    try {
      const text = await file.text()
      const backupData = JSON.parse(text)
      
      if (!backupData.version) {
        appendLog(t('backup.invalidFormat'), 'error')
        setRestoreLoading(false)
        return
      }
      
      appendLog(`${t('backup.backupVersion')}: ${backupData.version}`, 'info')
      appendLog(`${t('backup.backupTime')}: ${backupData.created_at || t('backup.unknown')}`, 'info')
      appendLog(`${t('backup.overrideMode')}: ${overrideExisting ? t('backup.yes') : t('backup.no')}`, 'info')
      
      const response = await api.post('/api/admin/restore', {
        data: backupData,
        override_existing: overrideExisting
      })
      
      if (response.data.code === 200) {
        const results = response.data.data.results || []
        
        const grouped: Record<string, { success: number, error: number }> = {}
        for (const result of results) {
          const type = result.type
          if (!grouped[type]) {
            grouped[type] = { success: 0, error: 0 }
          }
          if (result.status === 'success') {
            grouped[type].success++
          } else {
            grouped[type].error++
            appendLog(`${type}: ${result.name || result.key || result.path || result.username || ''} - ${result.message || t('backup.failed')}`, 'error')
          }
        }
        
        const typeNames: Record<string, string> = {
          setting: t('backup.siteSettings'),
          user: t('backup.users'),
          user_group: t('backup.userGroups'),
          user_group_member: t('backup.userGroupMembers'),
          driver: t('backup.drivers'),
          mount: t('backup.mounts'),
          meta: t('backup.metas'),
          share: t('backup.shares')
        }
        
        for (const [type, counts] of Object.entries(grouped)) {
          appendLog(`${typeNames[type] || type}: ${t('backup.success')} ${counts.success} ${t('backup.items')}${counts.error > 0 ? `, ${t('backup.failed')} ${counts.error} ${t('backup.items')}` : ''}`, counts.error > 0 ? 'error' : 'success')
        }
        
        appendLog(response.data.message, 'info')
      } else {
        appendLog(`${t('backup.restoreFailed')}: ${response.data.error || t('backup.unknown')}`, 'error')
      }
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        appendLog(t('backup.invalidJson'), 'error')
      } else {
        appendLog(`${t('backup.restoreFailed')}: ${error.message || t('backup.networkError')}`, 'error')
      }
    } finally {
      setRestoreLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const getLogIcon = (type: LogItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="backup-restore__log-icon backup-restore__log-icon--success" />
      case 'error':
        return <XCircle size={14} className="backup-restore__log-icon backup-restore__log-icon--error" />
      case 'info':
        return <Info size={14} className="backup-restore__log-icon backup-restore__log-icon--info" />
    }
  }

  return (
    <div className="admin-page backup-restore">
      <AdminPageHeader title={t('backup.title')} description={t('backup.description')} />

      <div className="backup-restore__actions">
        <button
          className="backup-restore__button backup-restore__button--primary"
          onClick={handleBackup}
          disabled={backupLoading || restoreLoading}
        >
          {backupLoading ? (
            <Loader2 size={18} className="backup-restore__button-icon spinning" />
          ) : (
            <Download size={18} className="backup-restore__button-icon" />
          )}
          {t('backup.backup')}
        </button>

        <button
          className="backup-restore__button"
          onClick={handleRestore}
          disabled={backupLoading || restoreLoading}
        >
          {restoreLoading ? (
            <Loader2 size={18} className="backup-restore__button-icon spinning" />
          ) : (
            <Upload size={18} className="backup-restore__button-icon" />
          )}
          {t('backup.restore')}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div className="backup-restore__options">
        <label className="backup-restore__option">
          <div className="backup-restore__switch">
            <input
              type="checkbox"
              checked={overrideExisting}
              onChange={(e) => setOverrideExisting(e.target.checked)}
              disabled={backupLoading || restoreLoading}
            />
            <span className="backup-restore__switch-track" />
          </div>
          <span>{t('backup.overrideExisting')}</span>
        </label>
      </div>

      <div className="backup-restore__log-container" ref={logContainerRef}>
        <div className="backup-restore__log-header">
          <span>{t('backup.operationLog')}</span>
          {logs.length > 0 && (
            <button className="backup-restore__log-clear" onClick={clearLogs}>
              {t('backup.clear')}
            </button>
          )}
        </div>
        <div className="backup-restore__log-content">
          {logs.length === 0 ? (
            <div className="backup-restore__log-empty">
              {t('backup.noLogs')}
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`backup-restore__log-item backup-restore__log-item--${log.type}`}>
                {getLogIcon(log.type)}
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
