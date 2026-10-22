import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Power, PowerOff, Settings, Plus, X, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { Select } from '../../components/Select'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/drivers.scss'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface Driver {
  id: string
  name: string
  driver_type: string
  version: string
  description: string
  enabled: boolean
  status: 'running' | 'disabled' | 'error'
  error?: string
  config: {
    driver_type: string
    mount_path: string
    order: number
    remark: string
    config: Record<string, any>
  }
}

interface DriverInfo {
  driver_type: string
  display_name: string
  description: string
  config_schema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export default function Drivers() {
  const { t } = useTranslation()
  const toast = useToast()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<DriverInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddDrawer, setShowAddDrawer] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [selectedDriverType, setSelectedDriverType] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [commonConfig, setCommonConfig] = useState({
    mount_path: '',
    order: 0,
    remark: ''
  })
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string | null}>({show: false, id: null})
  const [errorDetail, setErrorDetail] = useState<{show: boolean, error: string}>({show: false, error: ''})
  const [spaceInfo, setSpaceInfo] = useState<Record<string, {used: number, total: number, free: number} | null>>({})

  useEffect(() => {
    loadDrivers()
    loadAvailableDrivers()
  }, [])

  const loadSpaceInfo = async (driverId: string) => {
    try {
      const response = await api.get(`/api/drivers/${driverId}/space`)
      if (response.data.code === 200 && response.data.data) {
        setSpaceInfo(prev => ({
          ...prev,
          [driverId]: response.data.data
        }))
      }
    } catch (err) {
      // 静默失败，不影响正常显示
    }
  }

  const loadDrivers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/drivers')
      const driverList = response.data.drivers || []
      setDrivers(driverList)
      
      // 异步加载每个启用驱动的空间信息
      driverList.filter((d: Driver) => d.enabled).forEach((d: Driver) => {
        loadSpaceInfo(d.id)
      })
    } catch (err) {
      toast.error(t('drivers.loadFailed'))
      console.error('加载驱动失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableDrivers = async () => {
    try {
      const response = await api.get('/api/drivers/available')
      const drivers = response.data.drivers || []
      setAvailableDrivers(drivers)
      if (drivers.length > 0) {
        setSelectedDriverType(drivers[0].driver_type)
      }
    } catch (err) {
      console.error('加载可用驱动失败:', err)
    }
  }

  const handleToggleDriver = async (id: string, enabled: boolean) => {
    // 乐观更新：立即更新UI状态
    setDrivers(prev => prev.map(d => 
      d.id === id ? { ...d, enabled: !enabled, status: !enabled ? 'running' : 'disabled' } : d
    ))
    toast.success(enabled ? t('drivers.driverDisabled') : t('drivers.driverEnabled'))
    
    // 后台执行API调用
    try {
      if (enabled) {
        await api.post(`/api/drivers/${id}/disable`)
      } else {
        await api.post(`/api/drivers/${id}/enable`)
      }
      loadDrivers()
    } catch (err) {
      // 回滚状态
      setDrivers(prev => prev.map(d => 
        d.id === id ? { ...d, enabled, status: enabled ? 'running' : 'disabled' } : d
      ))
      toast.error(t('drivers.operationFailed'))
    }
  }

  const handleDeleteDriver = (id: string) => {
    setDeleteConfirm({show: true, id})
  }

  const confirmDeleteDriver = async () => {
    if (!deleteConfirm.id) return
    setDeleteConfirm({show: false, id: null})
    try {
      await api.post(`/api/drivers/${deleteConfirm.id}/delete`)
      toast.success('存储已删除')
      loadDrivers()
    } catch (err) {
      toast.error(t('drivers.operationFailed'))
    }
  }

  const handleReloadDriver = async (id: string) => {
    try {
      await api.post(`/api/drivers/${id}/reload`)
      toast.success('存储已重新加载')
      loadDrivers()
    } catch (err) {
      toast.error(t('drivers.operationFailed'))
    }
  }

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 应用默认值到配置中，并转换类型
    const finalConfig = { ...formData }
    if (selectedDriver?.config_schema?.properties) {
      for (const [key, schema] of Object.entries(selectedDriver.config_schema.properties) as [string, any][]) {
        if (finalConfig[key] === undefined || finalConfig[key] === '') {
          if (schema.default !== undefined) {
            finalConfig[key] = schema.default
          }
        }
        if (finalConfig[key] !== undefined && finalConfig[key] !== '') {
          if (schema.type === 'bool' || schema.type === 'boolean') {
            finalConfig[key] = finalConfig[key] === true || finalConfig[key] === 'true'
          } else if (schema.type === 'number') {
            const num = Number(finalConfig[key])
            if (!isNaN(num)) {
              finalConfig[key] = num
            }
          }
        }
      }
    }

    const isEditing = !!editingDriver
    const driverId = editingDriver?.id
    const requestData = { driver_type: selectedDriverType, ...commonConfig, config: finalConfig }
    
    // 乐观更新：立即关闭抽屉并显示成功
    setShowAddDrawer(false)
    setEditingDriver(null)
    setFormData({})
    setCommonConfig({ mount_path: '', order: 0, remark: '' })
    toast.success(isEditing ? t('drivers.updateSuccess') || '驱动更新成功' : t('drivers.createSuccess'))
    
    // 后台执行API调用
    try {
      let response
      if (isEditing && driverId) {
        response = await api.post(`/api/drivers/${driverId}`, requestData)
      } else {
        response = await api.post('/api/drivers', requestData)
      }
      
      if (response.data.code === 500) {
        toast.error(response.data.message || t('drivers.operationFailed'))
      } else if (response.data.warning) {
        toast.warning(response.data.warning)
      }
      loadDrivers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('drivers.operationFailed'))
      loadDrivers()
    }
  }

  const filteredDrivers = drivers.filter(driver => 
    (driver.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (driver.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedDriver = availableDrivers.find(d => d.driver_type === selectedDriverType)

  // 翻译字段标题和帮助文本（支持 i18n key）
  const translateField = (text: string | undefined) => {
    if (!text) return ''
    // 如果是 i18n key 格式（包含点），尝试翻译
    if (text.includes('.')) {
      const translated = t(text)
      // 如果翻译结果与原文相同，说明没有找到翻译，返回原文
      return translated !== text ? translated : text
    }
    return text
  }

  const renderDynamicField = (key: string, schema: any) => {
    // 获取当前值，优先使用表单数据，否则使用默认值
    const value = formData[key] ?? schema.default ?? ''
    const isRequired = selectedDriver?.config_schema.required?.includes(key)
    const title = translateField(schema.title) || key
    const description = translateField(schema.description)

    // 布尔类型使用 checkbox
    if (schema.type === 'bool' || schema.type === 'boolean') {
      const checked = value === true || value === 'true'
      return (
        <div key={key} className="drivers__form-field drivers__form-field--checkbox">
          <label>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setFormData({...formData, [key]: e.target.checked})}
            />
            {title}
          </label>
          {description && (
            <span className="drivers__field-hint">{description}</span>
          )}
        </div>
      )
    }

    // link类型显示为按钮，点击打开URL（支持{field}变量替换）
    if (schema.type === 'link' && schema.link) {
      const handleLinkClick = () => {
        // 替换URL中的{field}变量为表单数据
        let url = schema.link as string
        Object.keys(formData).forEach(field => {
          url = url.replace(new RegExp(`\\{${field}\\}`, 'g'), encodeURIComponent(formData[field] || ''))
        })
        window.open(url, '_blank')
      }
      return (
        <div key={key} className="drivers__form-field drivers__form-field--link">
          <button type="button" className="drivers__btn-link" onClick={handleLinkClick}>
            {title}
          </button>
          {description && (
            <span className="drivers__field-hint">{description}</span>
          )}
        </div>
      )
    }

    // action类型显示为按钮，点击发送POST请求
    if (schema.type === 'action' && schema.link) {
      const handleActionClick = async () => {
        try {
          const response = await fetch(schema.link as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
          })
          const result = await response.json()
          if (result.code === 200) {
            alert(result.message || '操作成功')
          } else {
            alert(result.message || '操作失败')
          }
        } catch (e) {
          alert('请求失败: ' + (e as Error).message)
        }
      }
      return (
        <div key={key} className="drivers__form-field drivers__form-field--link">
          <button type="button" className="drivers__btn-link" onClick={handleActionClick}>
            {title}
          </button>
          {description && (
            <span className="drivers__field-hint">{description}</span>
          )}
        </div>
      )
    }

    // oauth类型显示为按钮，弹窗授权后自动填入refresh_token
    if (schema.type === 'oauth' && schema.link) {
      const handleOAuthClick = async () => {
        // 构建回调地址
        const redirectUri = `${window.location.origin}/api/oauth/google/callback`
        
        // 替换URL中的{field}变量
        let url = schema.link as string
        Object.keys(formData).forEach(field => {
          url = url.replace(new RegExp(`\\{${field}\\}`, 'g'), encodeURIComponent(formData[field] || ''))
        })
        url = url.replace(/\{redirect_uri\}/g, encodeURIComponent(redirectUri))

        // 打开弹窗
        const popup = window.open(url, 'oauth_popup', 'width=600,height=700,scrollbars=yes')
        
        // 监听 postMessage 获取授权码
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'oauth_code' && event.data?.code) {
            window.removeEventListener('message', handleMessage)
            popup?.close()
            
            // 用授权码换取 refresh_token
            try {
              const response = await api.post('/api/oauth/google/exchange', {
                code: event.data.code,
                client_id: formData.client_id || '',
                client_secret: formData.client_secret || '',
                redirect_uri: redirectUri
              })
              
              if (response.data?.refresh_token) {
                setFormData({ ...formData, refresh_token: response.data.refresh_token })
                alert('获取刷新令牌成功！')
              } else if (response.data?.error) {
                alert('获取令牌失败: ' + response.data.error)
              }
            } catch (err: any) {
              alert('获取令牌失败: ' + (err.message || '未知错误'))
            }
          } else if (event.data?.type === 'oauth_error') {
            window.removeEventListener('message', handleMessage)
            popup?.close()
            alert('授权失败: ' + event.data.error)
          }
        }
        
        window.addEventListener('message', handleMessage)
      }
      
      return (
        <div key={key} className="drivers__form-field drivers__form-field--link">
          <button type="button" className="drivers__btn-link" onClick={handleOAuthClick}>
            {title}
          </button>
          {description && (
            <span className="drivers__field-hint">{description}</span>
          )}
        </div>
      )
    }

    // select类型使用下拉框（后端返回enum数组或options字符串）
    if (schema.type === 'select' && (schema.enum || schema.options)) {
      let optionsList: {value: string, label: string}[] = []
      
      if (schema.enum && Array.isArray(schema.enum)) {
        // enum格式: ["value1:label1", "value2:label2"] 或 ["value1", "value2"]
        optionsList = schema.enum.map((opt: string) => {
          const parts = opt.split(':')
          return {
            value: parts[0].trim(),
            label: parts[1]?.trim() || parts[0].trim()
          }
        })
      } else if (schema.options) {
        // options格式: "value1:label1,value2:label2" 或 "value1,value2"
        optionsList = schema.options.split(',').map((opt: string) => {
          const parts = opt.split(':')
          return {
            value: parts[0].trim(),
            label: parts[1]?.trim() || parts[0].trim()
          }
        })
      }
      return (
        <div key={key} className="drivers__form-field">
          <label>
            {title} {isRequired && '*'}
          </label>
          <Select
            value={value}
            onChange={(val) => setFormData({...formData, [key]: val})}
            options={optionsList}
            placeholder={t('common.select')}
            className="drivers__select"
          />
          {description && (
            <span className="drivers__field-hint">{description}</span>
          )}
        </div>
      )
    }

    return (
      <div key={key} className="drivers__form-field">
        <label>
          {title} {isRequired && '*'}
        </label>
        <input
          type={schema.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setFormData({...formData, [key]: e.target.value})}
          required={isRequired}
          placeholder={description || ''}
        />
        {description && (
          <span className="drivers__field-hint">{description}</span>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page drivers__container">
        <div className="admin-page__loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin-page drivers__container">
      <AdminPageHeader
        title={t('drivers.title')}
        actions={
          <>
            <div className="drivers__search">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('drivers.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="drivers__add-btn" type="button" onClick={() => setShowAddDrawer(true)}>
              <Plus size={18} />
              {t('drivers.addDriver')}
            </button>
          </>
        }
      />

      <div className="drivers__grid">
        {filteredDrivers.map((driver, index) => (
          <div key={driver.id || `driver-${index}`} className={`drivers__card ${driver.status === 'error' ? 'drivers__card--error' : ''}`}>
            <div className="drivers__card-header">
              <div className="drivers__card-title">
                <h3>{driver.name || '/'}</h3>
                <span className="drivers__card-type">{availableDrivers.find(d => d.driver_type.toLowerCase() === driver.driver_type.toLowerCase())?.display_name || driver.driver_type}</span>
              </div>
              <span className={`drivers__status-badge ${driver.status === 'error' ? 'drivers__status-badge--error' : driver.enabled ? 'drivers__status-badge--active' : ''}`}>
                {driver.status === 'error' ? t('drivers.error') || '错误' : driver.enabled ? t('drivers.enabled') : t('drivers.disabled')}
              </span>
            </div>
            {driver.error && (
              <div 
                className="drivers__card-error drivers__card-error--clickable"
                onClick={() => setErrorDetail({show: true, error: driver.error || ''})}
                title={t('drivers.clickToViewError') || '点击查看完整错误'}
              >
                <span className="drivers__error-text">{driver.error}</span>
              </div>
            )}
            {spaceInfo[driver.id] && (
              <div className="drivers__card-space">
                <div className="drivers__space-bar">
                  <div 
                    className="drivers__space-used" 
                    style={{ width: `${Math.min(100, (spaceInfo[driver.id]!.used / spaceInfo[driver.id]!.total) * 100)}%` }}
                  />
                </div>
                <span className="drivers__space-text">
                  {formatBytes(spaceInfo[driver.id]!.used)} / {formatBytes(spaceInfo[driver.id]!.total)}
                </span>
              </div>
            )}
            <div className="drivers__card-footer">
              <div className="drivers__card-actions">
                <button
                  className={`drivers__action-btn ${driver.enabled ? 'drivers__action-btn--danger' : 'drivers__action-btn--success'}`}
                  onClick={() => handleToggleDriver(driver.id, driver.enabled)}
                  title={driver.enabled ? t('drivers.disable') : t('drivers.enable')}
                >
                  {driver.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                </button>
                <button 
                  className="drivers__action-btn" 
                  title={t('drivers.configure')}
                  onClick={() => {
                    setEditingDriver(driver)
                    if (driver.config) {
                      setSelectedDriverType(driver.config.driver_type || driver.driver_type)
                      setCommonConfig({
                        mount_path: driver.config.mount_path || driver.name || '',
                        order: driver.config.order || 0,
                        remark: driver.config.remark || ''
                      })
                      // driver.config.config 包含驱动特有配置
                      const driverConfig = { ...(driver.config.config || {}) }
                      // 兼容旧数据：如果有 root_path 但没有 root，复制到 root
                      if (driverConfig.root_path && !driverConfig.root) {
                        driverConfig.root = driverConfig.root_path
                      }
                      delete driverConfig.root_path // 清理旧字段
                      setFormData(driverConfig)
                    } else {
                      setFormData({})
                    }
                    setShowAddDrawer(true)
                  }}
                >
                  <Settings size={16} />
                </button>
                <button 
                  className="drivers__action-btn" 
                  title="重新加载"
                  onClick={() => handleReloadDriver(driver.id)}
                >
                  <RefreshCw size={16} />
                </button>
                <button 
                  className="drivers__action-btn drivers__action-btn--danger" 
                  title="删除"
                  onClick={() => handleDeleteDriver(driver.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDrivers.length === 0 && (
        <div className="drivers__empty">
          <p>{t('drivers.noDrivers')}</p>
        </div>
      )}

      {showAddDrawer && (
        <div className={`drivers__drawer-overlay ${drawerClosing ? 'drivers__drawer-overlay--closing' : ''}`} onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowAddDrawer(false); setDrawerClosing(false); setEditingDriver(null); }, 300); }}>
          <div className={`drivers__drawer ${drawerClosing ? 'drivers__drawer--closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="drivers__drawer-header">
              <h2>{editingDriver ? t('drivers.configure') : t('drivers.addDriver')}</h2>
              <button className="drivers__drawer-close" onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowAddDrawer(false); setDrawerClosing(false); setEditingDriver(null); }, 300); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddDriver}>
              <div className="drivers__drawer-body">
              <div className="drivers__form-section">
                <h3>{t('drivers.basicInfo')}</h3>
                
                <div className="drivers__form-field">
                  <label>{t('drivers.driverType')} *</label>
                  <Select
                    value={selectedDriverType}
                    onChange={(value) => {
                      setSelectedDriverType(value)
                      setFormData({})
                    }}
                    options={availableDrivers.map(d => ({
                      value: d.driver_type,
                      label: d.display_name
                    }))}
                    searchable
                    className="drivers__select"
                  />
                  {selectedDriver && (
                    <span className="drivers__field-hint">{selectedDriver.description}</span>
                  )}
                </div>

                <div className="drivers__form-field">
                  <label>{t('drivers.mountPath')} *</label>
                  <input
                    type="text"
                    value={commonConfig.mount_path}
                    onChange={(e) => setCommonConfig({...commonConfig, mount_path: e.target.value})}
                    required
                    placeholder=""
                  />
                  <span className="drivers__field-hint">{t('drivers.mountPathHint')}</span>
                </div>

                <div className="drivers__form-field">
                  <label>{t('drivers.order')}</label>
                  <input
                    type="number"
                    value={commonConfig.order}
                    onChange={(e) => setCommonConfig({...commonConfig, order: Number(e.target.value)})}
                    placeholder="0"
                  />
                  <span className="drivers__field-hint">{t('drivers.orderHint')}</span>
                </div>

                <div className="drivers__form-field">
                  <label>{t('drivers.remark')}</label>
                  <textarea
                    value={commonConfig.remark}
                    onChange={(e) => setCommonConfig({...commonConfig, remark: e.target.value})}
                    rows={2}
                  />
                </div>

              </div>

                {selectedDriver && selectedDriver.config_schema?.properties && (
                  <div className="drivers__form-section">
                    <h3>{t('drivers.storageConfig')}</h3>
                    {Object.entries(selectedDriver.config_schema.properties)
                      .sort(([, a], [, b]) => ((a as any).order ?? 0) - ((b as any).order ?? 0))
                      .map(([key, schema]) => renderDynamicField(key, schema)
                    )}
                  </div>
                )}
              </div>
              <div className="drivers__drawer-footer">
                <button type="button" className="drivers__btn-cancel" onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowAddDrawer(false); setDrawerClosing(false); setEditingDriver(null); }, 300); }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="drivers__btn-submit">
                  {editingDriver ? t('common.save') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('drivers.deleteTitle', '删除驱动')}
        message={t('drivers.confirmDelete', '确定要删除此驱动吗？')}
        confirmText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
        onConfirm={confirmDeleteDriver}
        onCancel={() => setDeleteConfirm({show: false, id: null})}
        danger
      />

      <ConfirmDialog
        isOpen={errorDetail.show}
        title={t('drivers.errorDetail', '错误详情')}
        message={errorDetail.error}
        confirmText={t('common.close', '关闭')}
        onConfirm={() => setErrorDetail({show: false, error: ''})}
        onCancel={() => setErrorDetail({show: false, error: ''})}
      />
    </div>
  )
}
