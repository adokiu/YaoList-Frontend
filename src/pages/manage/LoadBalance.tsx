import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2, X, Layers, ChevronDown } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/pages/load-balance.scss'

interface DriverConfig {
  driver_id: string
  driver_name: string
  mount_path: string
  weight: number
  order: number
  is_china_node: boolean
  can_redirect: boolean
}

interface BalanceGroup {
  name: string
  mode: string
  drivers: DriverConfig[]
  enabled: boolean
}

interface ModeInfo {
  id: string
  name: string
  description: string
}

interface AvailableDriver {
  id: string
  name: string
  driver_type: string
  mount_path?: string
}

interface FormData {
  name: string
  mode: string
  enabled: boolean
  drivers: DriverConfig[]
}

const initialFormData: FormData = {
  name: '',
  mode: 'weighted_round_robin',
  enabled: true,
  drivers: []
}

export default function LoadBalance() {
  const { t } = useTranslation()
  const toast = useToast()
  const [groups, setGroups] = useState<BalanceGroup[]>([])
  const [modes, setModes] = useState<ModeInfo[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [editingGroup, setEditingGroup] = useState<BalanceGroup | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, name: string | null}>({show: false, name: null})
  const [saving, setSaving] = useState(false)
  const [showDriverDropdown, setShowDriverDropdown] = useState(false)
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const driverInputRef = useRef<HTMLDivElement>(null)
  const driverDropdownRef = useRef<HTMLDivElement>(null)
  const modeDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDriverDropdown) {
        const isInsideInput = driverInputRef.current?.contains(e.target as Node)
        const isInsideDropdown = driverDropdownRef.current?.contains(e.target as Node)
        if (!isInsideInput && !isInsideDropdown) {
          setShowDriverDropdown(false)
        }
      }
      if (showModeDropdown) {
        if (!modeDropdownRef.current?.contains(e.target as Node)) {
          setShowModeDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDriverDropdown, showModeDropdown])

  useEffect(() => {
    if (editingGroup) {
      setFormData({
        name: editingGroup.name,
        mode: editingGroup.mode,
        enabled: editingGroup.enabled,
        drivers: editingGroup.drivers || []
      })
    } else {
      setFormData(initialFormData)
    }
  }, [editingGroup])

  const loadData = async () => {
    setLoading(true)
    try {
      const [groupsRes, modesRes, driversRes] = await Promise.all([
        api.get('/api/load_balance/groups'),
        api.get('/api/load_balance/modes'),
        api.get('/api/drivers')
      ])
      
      if (groupsRes.data.code === 200) {
        setGroups(groupsRes.data.data?.groups || [])
      }
      if (modesRes.data.code === 200) {
        setModes(modesRes.data.data || [])
      }
      // /api/drivers 返回的是 drivers 字段而不是 data
      setAvailableDrivers(driversRes.data.drivers || [])
    } catch (error) {
      toast.error(t('loadBalance.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDrawer = (group?: BalanceGroup) => {
    setEditingGroup(group || null)
    setShowDrawer(true)
  }

  const handleCloseDrawer = () => {
    setDrawerClosing(true)
    setTimeout(() => {
      setShowDrawer(false)
      setDrawerClosing(false)
      setEditingGroup(null)
    }, 300)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(t('loadBalance.enterName'))
      return
    }
    if (formData.drivers.length === 0) {
      toast.error(t('loadBalance.addDriver'))
      return
    }
    
    setSaving(true)
    try {
      const endpoint = editingGroup ? '/api/load_balance/groups/update' : '/api/load_balance/groups'
      const res = await api.post(endpoint, formData)
      if (res.data.code === 200) {
        toast.success(editingGroup ? t('loadBalance.saveSuccess') : t('loadBalance.createSuccess'))
        handleCloseDrawer()
        loadData()
      } else {
        toast.error(res.data.message || t('loadBalance.operationFailed'))
      }
    } catch (error) {
      toast.error(t('loadBalance.operationFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm.name) return
    try {
      const res = await api.post('/api/load_balance/groups/delete', { name: deleteConfirm.name })
      if (res.data.code === 200) {
        toast.success(t('loadBalance.deleteSuccess'))
        loadData()
      } else {
        toast.error(res.data.message || t('loadBalance.deleteFailed'))
      }
    } catch (error) {
      toast.error(t('loadBalance.deleteFailed'))
    } finally {
      setDeleteConfirm({show: false, name: null})
    }
  }

  const addDriver = (driverId: string) => {
    const driver = availableDrivers.find(d => d.id === driverId)
    if (!driver) return
    
    if (formData.drivers.some(d => d.driver_id === driverId)) {
      toast.error(t('loadBalance.driverExists'))
      return
    }
    
    // 与Drivers.tsx保持一致：name字段是mount_path，id是驱动标识符
    setFormData({
      ...formData,
      drivers: [...formData.drivers, {
        driver_id: driver.id,
        driver_name: driver.name || '/',  // 显示mount_path作为名称
        mount_path: driver.name || '/',
        weight: 1,
        order: formData.drivers.length,
        is_china_node: false,
        can_redirect: driver.driver_type !== 'local'
      }]
    })
  }

  const updateDriver = (index: number, updates: Partial<DriverConfig>) => {
    const newDrivers = [...formData.drivers]
    newDrivers[index] = { ...newDrivers[index], ...updates }
    setFormData({ ...formData, drivers: newDrivers })
  }

  const removeDriver = (index: number) => {
    setFormData({
      ...formData,
      drivers: formData.drivers.filter((_, i) => i !== index)
    })
  }

  const getModeName = (modeId: string) => {
    // 优先使用翻译键，如果没有则使用后端返回的名称
    const translationKey = `loadBalance.modes.${modeId}`
    const translated = t(translationKey)
    if (translated !== translationKey) {
      return translated
    }
    return modes.find(m => m.id === modeId)?.name || modeId
  }

  const getModeDescription = (modeId: string) => {
    const translationKey = `loadBalance.modes.${modeId}_desc`
    const translated = t(translationKey)
    if (translated !== translationKey) {
      return translated
    }
    return modes.find(m => m.id === modeId)?.description || ''
  }

  if (loading) {
    return (
      <div className="admin-page load-balance">
        <div className="admin-page__loading">{t('loadBalance.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin-page load-balance">
      <AdminPageHeader
        title={t('loadBalance.title')}
        description={t('loadBalance.description')}
        actions={
          <button className="load-balance__add-btn" type="button" onClick={() => handleOpenDrawer()}>
            <Plus size={18} />
            <span>{t('loadBalance.add')}</span>
          </button>
        }
      />

      {groups.length === 0 ? (
        <div className="load-balance__empty">
          <div className="load-balance__empty-icon">
            <Layers size={40} />
          </div>
          <h3>{t('loadBalance.noGroups')}</h3>
          <p>{t('loadBalance.noGroupsHint')}</p>
          <button className="load-balance__empty-btn" onClick={() => handleOpenDrawer()}>
            <Plus size={20} />
            <span>{t('loadBalance.createGroup')}</span>
          </button>
        </div>
      ) : (
        <div className="load-balance__grid">
          {groups.map(group => (
            <div 
              key={group.name} 
              className={`load-balance__card ${!group.enabled ? 'load-balance__card--disabled' : ''}`}
            >
              <div className="load-balance__card-header">
                <div className="load-balance__card-title">
                  <h3>{group.name}</h3>
                </div>
                <div className="load-balance__card-actions">
                  <button 
                    className="load-balance__icon-btn" 
                    title={t('loadBalance.edit')} 
                    onClick={() => handleOpenDrawer(group)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="load-balance__icon-btn load-balance__icon-btn--danger" 
                    title={t('loadBalance.delete')}
                    onClick={() => setDeleteConfirm({show: true, name: group.name})}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="load-balance__card-info">
                <span className="load-balance__badge load-balance__badge--mode">
                  {getModeName(group.mode)}
                </span>
                <span className={`load-balance__badge ${group.enabled ? 'load-balance__badge--success' : 'load-balance__badge--disabled'}`}>
                  {group.enabled ? t('loadBalance.enabled') : t('loadBalance.disabled')}
                </span>
              </div>
              <div className="load-balance__card-drivers">
                {t('loadBalance.containsDrivers')} <span>{group.drivers?.length || 0}</span> {t('loadBalance.drivers')}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDrawer && (
        <div 
          className={`load-balance__drawer-overlay ${drawerClosing ? 'load-balance__drawer-overlay--closing' : ''}`} 
          onClick={handleCloseDrawer}
        >
          <div 
            className={`load-balance__drawer ${drawerClosing ? 'load-balance__drawer--closing' : ''}`} 
            onClick={e => e.stopPropagation()}
          >
            <div className="load-balance__drawer-header">
              <h2>{editingGroup ? t('loadBalance.editGroup') : t('loadBalance.addGroup')}</h2>
              <button className="load-balance__drawer-close" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>
            
            <div className="load-balance__drawer-body">
              <div className="load-balance__form-group">
                <label className="load-balance__label">{t('loadBalance.groupName')}</label>
                <input
                  type="text"
                  className="load-balance__input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  disabled={!!editingGroup}
                  placeholder={t('loadBalance.groupNamePlaceholder')}
                />
              </div>

              <div className="load-balance__form-group">
                <label className="load-balance__label">{t('loadBalance.mode')}</label>
                <div className="load-balance__custom-select" ref={modeDropdownRef}>
                  <div 
                    className={`load-balance__select-trigger ${showModeDropdown ? 'load-balance__select-trigger--open' : ''}`}
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                  >
                    <span>{getModeName(formData.mode) || t('loadBalance.selectMode')}</span>
                    <ChevronDown size={16} className={`load-balance__select-arrow ${showModeDropdown ? 'load-balance__select-arrow--open' : ''}`} />
                  </div>
                  <div className={`load-balance__select-dropdown ${showModeDropdown ? 'load-balance__select-dropdown--open' : ''}`}>
                    {modes.map(mode => (
                      <div
                        key={mode.id}
                        className={`load-balance__select-option ${formData.mode === mode.id ? 'load-balance__select-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({...formData, mode: mode.id})
                          setShowModeDropdown(false)
                        }}
                      >
                        <div className="load-balance__select-option-content">
                          <span className="load-balance__select-option-name">{getModeName(mode.id)}</span>
                          <span className="load-balance__select-option-desc">{getModeDescription(mode.id)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="load-balance__form-group">
                <label className="load-balance__checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({...formData, enabled: e.target.checked})}
                  />
                  <span>{t('loadBalance.enableGroup')}</span>
                </label>
              </div>

              <div className="load-balance__form-group">
                <label className="load-balance__label">{t('loadBalance.selectDriver')}</label>
                <div className="load-balance__driver-selector">
                  <div 
                    ref={driverInputRef}
                    className="load-balance__driver-input-wrapper"
                    onClick={() => {
                      if (driverInputRef.current) {
                        const rect = driverInputRef.current.getBoundingClientRect()
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width
                        })
                      }
                      setShowDriverDropdown(!showDriverDropdown)
                    }}
                  >
                    {formData.drivers.length === 0 ? (
                      <span className="load-balance__driver-placeholder">{t('loadBalance.clickToSelect')}</span>
                    ) : (
                      <div className="load-balance__selected-drivers">
                        {formData.drivers.map((driver, idx) => (
                          <span 
                            key={driver.driver_id} 
                            className="load-balance__driver-chip"
                            onClick={(e) => { e.stopPropagation(); removeDriver(idx); }}
                          >
                            {driver.driver_name}
                            <X size={14} />
                          </span>
                        ))}
                      </div>
                    )}
                    <ChevronDown size={18} className="load-balance__driver-arrow" />
                  </div>
                  
                  {showDriverDropdown && (
                    <div 
                      ref={driverDropdownRef}
                      className="load-balance__driver-dropdown"
                      style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`
                      }}
                    >
                      {(() => {
                        // 后端返回的name字段实际上是mount_path
                        // 获取当前已选驱动的挂载路径（如果有）
                        const selectedMountPath = formData.drivers.length > 0 
                          ? formData.drivers[0].mount_path 
                          : null;
                        
                        // 过滤驱动：未选择时显示所有，已选择时只显示同挂载路径的
                        const filteredDrivers = availableDrivers.filter(d => {
                          // 排除已添加的
                          if (formData.drivers.some(fd => fd.driver_id === d.id)) return false;
                          // 如果已选择了驱动，只显示同挂载路径的（d.name实际上是mount_path）
                          if (selectedMountPath && d.name !== selectedMountPath) return false;
                          return true;
                        });
                        
                        if (filteredDrivers.length === 0) {
                          return (
                            <div className="load-balance__driver-option load-balance__driver-option--empty">
                              {selectedMountPath 
                                ? t('loadBalance.noMoreDriversForPath', { path: selectedMountPath })
                                : t('loadBalance.noDriversAvailable')}
                            </div>
                          );
                        }
                        
                        return filteredDrivers.map(d => (
                          <div 
                            key={d.id} 
                            className="load-balance__driver-option"
                            onClick={() => { addDriver(d.id); }}
                          >
                            <span className="load-balance__driver-option-name">{d.name || '/'}</span>
                            <span className="load-balance__driver-option-type">{d.driver_type}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {formData.drivers.length > 0 && (
                <div className="load-balance__form-group">
                  <label className="load-balance__label">{t('loadBalance.driverConfig')}</label>
                  <div className="load-balance__driver-list">
                    {formData.drivers.map((driver, idx) => (
                      <div key={driver.driver_id} className="load-balance__driver-item">
                        <div className="load-balance__driver-header">
                          <span className="load-balance__driver-name">{driver.driver_name}</span>
                          <button 
                            className="load-balance__icon-btn load-balance__icon-btn--danger"
                            onClick={() => removeDriver(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="load-balance__driver-options">
                          {formData.mode === 'weighted_round_robin' && (
                            <div className="load-balance__driver-field">
                              <label>{t('loadBalance.weight')}</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={driver.weight}
                                onChange={e => updateDriver(idx, { weight: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                          )}
                          {formData.mode === 'geo_region' && (
                            <label className="load-balance__checkbox-label">
                              <input
                                type="checkbox"
                                checked={driver.is_china_node}
                                onChange={e => updateDriver(idx, { is_china_node: e.target.checked })}
                              />
                              <span>{t('loadBalance.chinaNode')}</span>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="load-balance__drawer-footer">
              <button className="load-balance__btn load-balance__btn--secondary" onClick={handleCloseDrawer}>
                {t('common.cancel')}
              </button>
              <button 
                className="load-balance__btn load-balance__btn--primary" 
                onClick={handleSave} 
                disabled={saving}
              >
                {saving ? t('loadBalance.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('loadBalance.deleteConfirmTitle')}
        message={t('loadBalance.confirmDelete', { name: deleteConfirm.name })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({show: false, name: null})}
      />
    </div>
  )
}
