import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  RefreshCw, Save, Trash2, Square, 
  Database, AlertCircle, CheckCircle, RotateCcw
} from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/search-management.scss'

interface SearchSettings {
  enabled: boolean
  auto_update_index: boolean
  ignore_paths: string
  max_index_depth: number
}

interface IndexStatus {
  status: 'idle' | 'indexing' | 'scanning' | 'error' | 'not_built'
  object_count: number
  index_size: number
  last_updated: string | null
  error_message: string | null
}


// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function SearchManagement() {
  const { t } = useTranslation()
  const toast = useToast()
  
  const [settings, setSettings] = useState<SearchSettings>({
    enabled: false,
    auto_update_index: true,
    ignore_paths: '',
    max_index_depth: 20
  })
  
  const [indexStatus, setIndexStatus] = useState<IndexStatus>({
    status: 'idle',
    object_count: 0,
    index_size: 0,
    last_updated: null,
    error_message: null
  })
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    loadSettings()
    loadIndexStatus()
  }, [])

  // 索引构建中时轮询状态
  useEffect(() => {
    if (indexStatus.status === 'indexing') {
      const interval = setInterval(() => {
        loadIndexStatus()
      }, 1000) // 每秒刷新
      return () => clearInterval(interval)
    }
  }, [indexStatus.status])


  const loadSettings = async () => {
    try {
      const res = await api.get('/api/admin/search/settings')
      if (res.data.code === 200) {
        setSettings(res.data.data)
      }
    } catch (err) {
      console.error('Failed to load search settings:', err)
    }
  }

  const loadIndexStatus = async () => {
    try {
      const res = await api.get('/api/admin/search/status')
      if (res.data.code === 200) {
        setIndexStatus(res.data.data)
      }
    } catch (err) {
      console.error('Failed to load index status:', err)
    }
  }


  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await api.post('/api/admin/search/settings', settings)
      if (res.data.code === 200) {
        toast.success(t('search.saveSuccess', '设置保存成功'))
      } else {
        toast.error(res.data.message || t('search.saveFailed', '保存失败'))
      }
    } catch (err) {
      toast.error(t('search.saveFailed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const loadDefaultSettings = () => {
    setSettings({
      enabled: false,
      auto_update_index: true,
      ignore_paths: '',
      max_index_depth: 20
    })
    toast.info(t('search.defaultLoaded', '已加载默认设置'))
  }

  const rebuildIndex = async () => {
    setLoading(true)
    try {
      const res = await api.post('/api/admin/search/index/rebuild')
      if (res.data.code === 200) {
        toast.success(t('search.rebuildStarted', '重建索引任务已启动'))
        loadIndexStatus()
      } else {
        toast.error(res.data.message || t('search.rebuildFailed', '重建索引失败'))
      }
    } catch (err) {
      toast.error(t('search.rebuildFailed', '重建索引失败'))
    } finally {
      setLoading(false)
    }
  }

  const handleClearIndex = () => {
    setShowClearConfirm(true)
  }

  const confirmClearIndex = async () => {
    setShowClearConfirm(false)
    setLoading(true)
    try {
      const res = await api.post('/api/admin/search/index/clear')
      if (res.data.code === 200) {
        toast.success(t('search.clearSuccess', '索引已清除'))
        loadIndexStatus()
      } else {
        toast.error(res.data.message || t('search.clearFailed', '清除索引失败'))
      }
    } catch (err) {
      toast.error(t('search.clearFailed', '清除索引失败'))
    } finally {
      setLoading(false)
    }
  }

  const stopIndexing = async () => {
    try {
      const res = await api.post('/api/admin/search/index/stop')
      if (res.data.code === 200) {
        toast.success(t('search.indexingStopped', '索引已停止'))
        loadIndexStatus()
      }
    } catch (err) {
      toast.error(t('search.stopFailed', '停止失败'))
    }
  }


  return (
    <div className="admin-page search-page">
      <AdminPageHeader title={t('menu.searchManagement', '搜索管理')} />
      {/* 索引设置卡片 */}
      <div className="search-page__card">
        <div className="search-page__card-header">
          <h3>{t('search.indexSettings', '搜索索引设置')}</h3>
        </div>
        
        <div className="search-page__card-body">
          {/* 启用搜索开关 */}
          <div className="search-page__setting-row">
            <div className="search-page__setting-info">
              <span className="search-page__setting-label">{t('search.enableSearch', '启用搜索功能')}</span>
              <span className="search-page__setting-desc">{t('search.enableSearchDesc', '开启后可使用全文搜索')}</span>
            </div>
            <label className="search-page__toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              <span className="search-page__toggle-slider"></span>
            </label>
          </div>

          {/* 自动更新索引开关 */}
          <div className="search-page__setting-row">
            <div className="search-page__setting-info">
              <span className="search-page__setting-label">{t('search.autoUpdateIndex', '自动更新索引')}</span>
              <span className="search-page__setting-desc">{t('search.autoUpdateDesc', '文件变更时自动更新索引')}</span>
            </div>
            <label className="search-page__toggle">
              <input
                type="checkbox"
                checked={settings.auto_update_index}
                onChange={(e) => setSettings({ ...settings, auto_update_index: e.target.checked })}
              />
              <span className="search-page__toggle-slider"></span>
            </label>
          </div>

          {/* 忽略路径 */}
          <div className="search-page__setting-block">
            <label className="search-page__label">{t('search.ignorePaths', '忽略路径')}</label>
            <textarea
              value={settings.ignore_paths}
              onChange={(e) => setSettings({ ...settings, ignore_paths: e.target.value })}
              placeholder={t('search.ignorePathsHint', '每行一条路径')}
              className="search-page__textarea"
              rows={4}
            />
          </div>

          {/* 最大索引深度 */}
          <div className="search-page__setting-block">
            <label className="search-page__label">{t('search.maxIndexDepth', '最大索引深度')}</label>
            <div className="search-page__input-group">
              <input
                type="number"
                value={settings.max_index_depth}
                onChange={(e) => setSettings({ ...settings, max_index_depth: parseInt(e.target.value) || 20 })}
                min={1}
                max={100}
                className="search-page__input"
              />
              <span className="search-page__input-hint">{t('search.maxIndexDepthHint', '索引的最大深度')}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="search-page__actions">
            <button 
              className="search-page__btn search-page__btn--secondary"
              onClick={loadDefaultSettings}
            >
              <RotateCcw size={16} />
              {t('search.loadDefault', '加载默认')}
            </button>
            <button 
              className="search-page__btn search-page__btn--primary"
              onClick={saveSettings}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? t('search.saving', '保存中...') : t('search.save', '保存')}
            </button>
          </div>
        </div>
      </div>

      {/* 当前索引卡片 */}
      <div className="search-page__card">
        <div className="search-page__card-header">
          <h3>{t('search.currentIndex', '当前索引')}</h3>
          <button 
            className="search-page__icon-btn"
            onClick={loadIndexStatus}
            title={t('search.refresh', '刷新')}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        
        <div className="search-page__card-body">
          {/* 状态显示 */}
          <div className="search-page__stats">
            <div className="search-page__stat-item">
              <span className="search-page__stat-label">{t('search.indexStatus', '索引状态')}</span>
              <span className={`search-page__stat-value search-page__stat-value--${indexStatus.status}`}>
                {indexStatus.status === 'indexing' || indexStatus.status === 'scanning' ? (
                  <RefreshCw size={14} className="search-page__spinning" />
                ) : indexStatus.status === 'error' ? (
                  <AlertCircle size={14} />
                ) : indexStatus.status === 'not_built' ? (
                  <Database size={14} />
                ) : (
                  <CheckCircle size={14} />
                )}
                {indexStatus.status === 'indexing' ? t('search.statusIndexing', '索引中...') :
                 indexStatus.status === 'scanning' ? t('search.statusScanning', '扫描中...') :
                 indexStatus.status === 'error' ? t('search.statusError', '错误') :
                 indexStatus.status === 'not_built' ? t('search.statusNotBuilt', '未构建') :
                 t('search.statusIdle', '待命')}
              </span>
            </div>
            <div className="search-page__stat-item">
              <span className="search-page__stat-label">{t('search.objectCount', '对象计数')}</span>
              <span className="search-page__stat-value search-page__stat-value--highlight">
                {indexStatus.object_count.toLocaleString()}
              </span>
            </div>
            <div className="search-page__stat-item">
              <span className="search-page__stat-label">{t('search.indexSize', '索引大小')}</span>
              <span className="search-page__stat-value">
                {formatFileSize(indexStatus.index_size)}
              </span>
            </div>
            {indexStatus.last_updated && (
              <div className="search-page__stat-item">
                <span className="search-page__stat-label">{t('search.lastUpdated', '上次更新')}</span>
                <span className="search-page__stat-value">
                  {new Date(indexStatus.last_updated).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {indexStatus.error_message && (
            <div className="search-page__error">
              <AlertCircle size={16} />
              <span>{indexStatus.error_message}</span>
            </div>
          )}

          {/* 索引操作按钮 */}
          <div className="search-page__actions">
            <button 
              className="search-page__btn search-page__btn--danger"
              onClick={handleClearIndex}
              disabled={loading || indexStatus.status === 'indexing'}
            >
              <Trash2 size={16} />
              {t('search.clear', '清除')}
            </button>
            <button 
              className="search-page__btn search-page__btn--warning"
              onClick={stopIndexing}
              disabled={indexStatus.status !== 'indexing'}
            >
              <Square size={16} />
              {t('search.stop', '停止')}
            </button>
            <button 
              className="search-page__btn search-page__btn--success"
              onClick={rebuildIndex}
              disabled={loading || indexStatus.status === 'indexing'}
            >
              <Database size={16} />
              {indexStatus.status === 'not_built' || indexStatus.object_count === 0
                ? t('search.buildIndex', '构建索引') 
                : t('search.rebuildIndex', '重建索引')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title={t('search.clearTitle', '清除索引')}
        message={t('search.clearConfirm', '确定要清除所有索引吗？此操作不可恢复。')}
        confirmText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
        onConfirm={confirmClearIndex}
        onCancel={() => setShowClearConfirm(false)}
        danger
      />
    </div>
  )
}
