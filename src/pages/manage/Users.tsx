import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Edit, Trash2, X, CheckCircle, XCircle, Folder } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { Select } from '../../components/Select'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageLayout } from '../../components/PageLayout/PageLayout'
import { DataTable, type Column } from '../../components/DataTable/DataTable'
import { SearchInput } from '../../components/SearchInput/SearchInput'
import { Button } from '../../components/Button/Button'
import { TableActions, TableCell, TableLinkButton } from '../../components/manage/tableCells'
import '../../styles/pages/users.scss'
import '../../styles/components/batch-bar.scss'

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

interface User {
  id: string
  unique_id: string
  username: string
  email: string | null
  phone: string | null
  root_path: string | null
  is_admin: boolean
  enabled: boolean
  two_factor_enabled: boolean
  total_traffic: number
  total_requests: number
  last_login: string | null
  created_at: string
}

interface UserGroup {
  id: string
  name: string
}

interface PaginationData {
  users: User[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export default function Users() {
  const { t } = useTranslation()
  const toast = useToast()
  const [data, setData] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userGroups, setUserGroups] = useState<{[key: string]: UserGroup[]}>({})
  const [allGroups, setAllGroups] = useState<UserGroup[]>([])
  const [filters, setFilters] = useState({
    enabled: 'all' as 'all' | 'enabled' | 'disabled',
    has_2fa: 'all' as 'all' | 'yes' | 'no',
    group_id: ''
  })
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    root_path: '/',
    password: '',
    enabled: true,
    two_factor_enabled: false,
    group_id: ''
  })
  const [showGroupSelector, setShowGroupSelector] = useState(false)
  const [groupSearchTerm, setGroupSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  const [showPathSelector, setShowPathSelector] = useState(false)
  const [dirs, setDirs] = useState<{name: string, path: string}[]>([])
  const [currentBrowsePath, setCurrentBrowsePath] = useState('/')

  useEffect(() => {
    loadUsers()
    loadAllGroups()
  }, [currentPage, search, pageSize, filters])

  useEffect(() => {
    if (data) {
      data.users.forEach(user => loadUserGroups(user.id))
    }
  }, [data])

  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        email: editingUser.email || '',
        phone: editingUser.phone || '',
        root_path: editingUser.root_path || '/',
        password: '',
        enabled: editingUser.enabled,
        two_factor_enabled: editingUser.two_factor_enabled,
        group_id: userGroups[editingUser.id]?.[0]?.id || ''
      })
    } else {
      setFormData({
        username: '',
        email: '',
        phone: '',
        root_path: '/',
        password: '',
        enabled: true,
        two_factor_enabled: false,
        group_id: ''
      })
    }
  }, [editingUser, userGroups])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      })
      if (search) {
        params.append('search', search)
      }
      const response = await api.get(`/api/users?${params}`)
      setData(response.data)
    } catch (err) {
      toast.error(t('users.loadFailed'))
      console.error('加载用户失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserGroups = async (userId: string) => {
    try {
      const response = await api.get(`/api/users/${userId}`)
      setUserGroups(prev => ({
        ...prev,
        [userId]: response.data.groups || []
      }))
    } catch (err) {
      console.error('加载用户组失败:', err)
    }
  }

  const loadAllGroups = async () => {
    try {
      const response = await api.get('/api/groups')
      setAllGroups(response.data.groups || [])
    } catch (err) {
      console.error('加载用户组列表失败:', err)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const loadDirs = async (path: string) => {
    try {
      const response = await api.post('/api/admin/fs/list', { path: path || '/' })
      if (response.data.code === 200) {
        const allFiles = response.data.data?.content || []
        const directories = allFiles.filter((f: any) => f.is_dir).map((f: any) => ({
          name: f.name,
          path: path === '/' ? `/${f.name}` : `${path}/${f.name}`
        }))
        setDirs(directories)
        setCurrentBrowsePath(path)
      }
    } catch (err) {
      console.error('加载目录失败:', err)
    }
  }

  const handleSelectRootPath = (path: string) => {
    setFormData({ ...formData, root_path: path })
    setShowPathSelector(false)
  }

  const handleToggleStatus = async (userId: string, enabled: boolean) => {
    try {
      await api.post(`/api/users/${userId}`, { enabled: !enabled })
      toast.success(enabled ? t('users.userDisabled') : t('users.userEnabled'))
      loadUsers()
    } catch (err) {
      toast.error(t('users.operationFailed'))
    }
  }

  const handleDelete = useCallback((userId: string, username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('users.deleteConfirm'),
      message: `${t('users.deleteConfirmMessage')} "${username}"?`,
      onConfirm: async () => {
        try {
          await api.post(`/api/users/${userId}/delete`)
          toast.success(t('users.deleteSuccess'))
          loadUsers()
        } catch (err) {
          toast.error(t('users.deleteFailed'))
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
      }
    })
  }, [t, toast])

  const formatTimestamp = (dateStr: string) =>
    new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const openCreate = useCallback(() => {
    setEditingUser(null)
    setShowEditDialog(true)
  }, [])

  const columns: Column<User>[] = useMemo(
    () => [
      {
        key: 'id',
        title: t('users.id'),
        fixedWidth: true,
        width: 80,
        render: (user) => (
          <TableCell>
            <code className="users__unique-id">{user.unique_id}</code>
          </TableCell>
        ),
      },
      {
        key: 'username',
        title: t('users.username'),
        render: (user) => (
          <TableCell large>
            <div className="users__username">{user.username}</div>
          </TableCell>
        ),
      },
      {
        key: 'email',
        title: t('users.email'),
        render: (user) => <TableCell>{user.email || '-'}</TableCell>,
      },
      {
        key: 'phone',
        title: t('users.phone'),
        render: (user) => <TableCell>{user.phone || '-'}</TableCell>,
      },
      {
        key: 'groups',
        title: t('users.userGroup'),
        render: (user) => (
          <TableCell>
            <div className="users__groups">
              {userGroups[user.id]?.length > 0 ? (
                userGroups[user.id].map((group) => (
                  <span key={group.id} className="users__group-tag">
                    {group.name}
                  </span>
                ))
              ) : (
                <span className="users__no-group">{t('users.noGroup')}</span>
              )}
            </div>
          </TableCell>
        ),
      },
      {
        key: 'total_traffic',
        title: t('users.totalTraffic'),
        render: (user) => (
          <TableCell>
            <span className="users__traffic">{formatTraffic(user.total_traffic)}</span>
          </TableCell>
        ),
      },
      {
        key: 'total_requests',
        title: t('users.requests'),
        render: (user) => (
          <TableCell>
            <span className="users__requests">{formatNumber(user.total_requests)}</span>
          </TableCell>
        ),
      },
      {
        key: 'enabled',
        title: t('users.status'),
        render: (user) => (
          <button
            type="button"
            className={`users__status-toggle data-table-tag ${user.enabled ? 'users__status-toggle--active' : 'users__status-toggle--inactive'}`}
            onClick={() => handleToggleStatus(user.id, user.enabled)}
            title={user.enabled ? t('users.disable') : t('users.enable')}
          >
            {user.enabled ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {user.enabled ? t('users.enabled') : t('users.disabled')}
          </button>
        ),
      },
      {
        key: 'created_at',
        title: t('users.createdAt'),
        render: (user) => (
          <TableCell>
            <span className="users__timestamp">{formatTimestamp(user.created_at)}</span>
          </TableCell>
        ),
      },
      {
        key: 'last_login',
        title: t('users.lastLogin'),
        render: (user) => (
          <TableCell>
            <span className="users__timestamp">
              {user.last_login ? formatTimestamp(user.last_login) : t('users.neverLogin')}
            </span>
          </TableCell>
        ),
      },
      {
        key: 'actions',
        title: t('users.actions'),
        render: (user) => (
          <TableActions>
            <TableLinkButton
              onClick={() => {
                setEditingUser(user)
                setShowEditDialog(true)
              }}
            >
              <Edit size={14} />
              {t('users.edit')}
            </TableLinkButton>
            <TableLinkButton danger onClick={() => handleDelete(user.id, user.username)}>
              <Trash2 size={14} />
              {t('users.delete')}
            </TableLinkButton>
          </TableActions>
        ),
      },
    ],
    [t, userGroups, handleDelete],
  )

  const selectedKeys = useMemo(() => new Set(selectedUsers), [selectedUsers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingUser) {
        const updateData: Record<string, any> = {
          username: formData.username,
          enabled: formData.enabled,
          two_factor_enabled: formData.two_factor_enabled,
          group_ids: formData.group_id ? [String(formData.group_id)] : []
        }
        // 只发送非空的可选字段
        if (formData.email) updateData.email = formData.email
        if (formData.phone) updateData.phone = formData.phone
        if (formData.root_path) updateData.root_path = formData.root_path
        if (formData.password) updateData.password = formData.password
        
        console.log('Sending update data:', updateData)
        await api.post(`/api/users/${editingUser.id}`, updateData)
        toast.success(t('users.updateSuccess'))
      } else {
        if (!formData.password) {
          toast.error(t('users.passwordRequired'))
          return
        }
        const createData = {
          username: formData.username,
          password: formData.password,
          email: formData.email || null,
          phone: formData.phone || null,
          group_ids: formData.group_id ? [String(formData.group_id)] : []
        }
        await api.post('/api/users', createData)
        toast.success(t('users.createSuccess'))
      }
      setShowEditDialog(false)
      setEditingUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('users.operationFailed'))
    }
  }

  return (
    <div className="manage-page users__container">
      <PageLayout
        leftSlot={
          <>
            <SearchInput
              value={search}
              placeholder={t('users.searchPlaceholder')}
              onChange={handleSearch}
            />
            <div className="users__filters">
              <Select
                value={filters.enabled}
                onChange={(value) => setFilters({ ...filters, enabled: value as typeof filters.enabled })}
                options={[
                  { value: 'all', label: t('users.allStatus') },
                  { value: 'enabled', label: t('users.enabled') },
                  { value: 'disabled', label: t('users.disabled') },
                ]}
              />
              <Select
                value={filters.has_2fa}
                onChange={(value) => setFilters({ ...filters, has_2fa: value as typeof filters.has_2fa })}
                options={[
                  { value: 'all', label: t('users.all2FA') },
                  { value: 'yes', label: t('users.2FAEnabled') },
                  { value: 'no', label: t('users.2FADisabled') },
                ]}
              />
              <Select
                value={filters.group_id}
                onChange={(value) => setFilters({ ...filters, group_id: value })}
                options={[
                  { value: '', label: t('users.allGroups') },
                  ...allGroups.map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
            </div>
          </>
        }
        rightSlot={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} />
            {t('users.addUser')}
          </Button>
        }
      >
        {selectedUsers.length > 0 && (
          <div className="manage-page__batch users__batch-bar">
            <span className="users__batch-count">
              {t('users.batchSelected')} {selectedUsers.length}
            </span>
            <div className="users__batch-actions">
              <button type="button" className="users__batch-btn">
                {t('users.batchEnable')}
              </button>
              <button type="button" className="users__batch-btn">
                {t('users.batchDisable')}
              </button>
              <button type="button" className="users__batch-btn">
                {t('users.changeGroup')}
              </button>
              <button type="button" className="users__batch-btn">
                {t('users.changeRootPath')}
              </button>
              <button type="button" className="users__batch-btn users__batch-btn--danger">
                {t('users.batchDelete')}
              </button>
              <button type="button" className="users__batch-btn" onClick={() => setSelectedUsers([])}>
                {t('users.cancelSelection')}
              </button>
            </div>
          </div>
        )}

        <div className="manage-page__table-fill">
          <DataTable
            columns={columns}
            data={data?.users ?? []}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={t('users.noData', { defaultValue: '暂无数据' })}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={(keys) => setSelectedUsers([...keys].map((k) => String(k)))}
            tableClassName="data-table--entity-list"
            listLayoutId="users"
            pagination={
              data ? { page: currentPage, size: pageSize, total: data.total } : undefined
            }
            onPageChange={setCurrentPage}
            onSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
          />
        </div>
      </PageLayout>

      {showEditDialog && (
        <div className={`users__drawer-overlay ${drawerClosing ? 'users__drawer-overlay--closing' : ''}`} onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowEditDialog(false); setDrawerClosing(false); }, 300); }}>
          <div className={`users__drawer ${drawerClosing ? 'users__drawer--closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="users__drawer-header">
              <h2>{editingUser ? t('users.editUser') : t('users.addUser')}</h2>
              <button className="users__drawer-close" onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowEditDialog(false); setDrawerClosing(false); }, 300); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="users__drawer-body">
              <div className="users__form-field">
                <label>{t('users.usernameLabel')} *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  placeholder={t('users.usernamePlaceholder')}
                />
              </div>

              <div className="users__form-field">
                <label>{t('users.emailLabel')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder={t('users.emailPlaceholder')}
                />
              </div>

              <div className="users__form-field">
                <label>{t('users.phoneLabel')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder={t('users.phonePlaceholder')}
                />
              </div>

              <div className="users__form-field">
                <label>{t('users.rootPathLabel')}</label>
                <div className="users__path-input-wrapper">
                  <input
                    type="text"
                    value={formData.root_path}
                    onChange={(e) => setFormData({...formData, root_path: e.target.value})}
                    placeholder={t('users.rootPathPlaceholder')}
                  />
                  <button 
                    type="button"
                    className="users__path-select-btn"
                    onClick={() => {
                      setShowPathSelector(true)
                      loadDirs('/')
                    }}
                  >
                    {t('users.selectPath', '选择')}
                  </button>
                </div>
              </div>

              <div className="users__form-field">
                <label>{editingUser ? t('users.newPasswordLabel') : `${t('users.passwordLabel')} *`}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required={!editingUser}
                  placeholder={t('users.passwordPlaceholder')}
                />
              </div>

              <div className="users__form-field">
                <label>{t('users.userGroupLabel')}</label>
                <div className="users__group-input-wrapper">
                  <input
                    type="text"
                    className="users__group-input"
                    placeholder={t('users.groupPlaceholder')}
                    value={formData.group_id ? allGroups.find(g => g.id === formData.group_id)?.name || '' : ''}
                    onClick={() => setShowGroupSelector(true)}
                    readOnly
                  />
                  {formData.group_id && (
                    <button
                      type="button"
                      className="users__group-clear"
                      onClick={() => setFormData({...formData, group_id: ''})}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {showGroupSelector && (
                <div className="users__modal-overlay" onClick={() => setShowGroupSelector(false)}>
                  <div className="users__modal" onClick={(e) => e.stopPropagation()}>
                    <div className="users__modal-header">
                      <h3>{t('users.selectGroup')}</h3>
                      <button onClick={() => setShowGroupSelector(false)}>
                        <X size={20} />
                      </button>
                    </div>
                    <div className="users__modal-search">
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder={t('users.searchGroup')}
                        value={groupSearchTerm}
                        onChange={(e) => setGroupSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="users__modal-body">
                      {allGroups
                        .filter(group => group.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                        .map(group => (
                        <button
                          key={group.id}
                          type="button"
                          className={`users__group-card ${formData.group_id === group.id ? 'users__group-card--selected' : ''}`}
                          onClick={() => {
                            setFormData({...formData, group_id: group.id})
                            setShowGroupSelector(false)
                            setGroupSearchTerm('')
                          }}
                        >
                          <div className="users__group-card-name">{group.name}</div>
                          {formData.group_id === group.id && (
                            <CheckCircle size={16} className="users__group-card-check" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="users__form-switches">
                <label className="users__switch-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                  />
                  <span>{t('users.enableUser')}</span>
                </label>

                <label className="users__switch-label">
                  <input
                    type="checkbox"
                    checked={formData.two_factor_enabled}
                    onChange={(e) => setFormData({...formData, two_factor_enabled: e.target.checked})}
                  />
                  <span>{t('users.enable2FA')}</span>
                </label>
              </div>

              </div>
              <div className="users__drawer-footer">
                <button type="button" className="users__btn-cancel" onClick={() => { setDrawerClosing(true); setTimeout(() => { setShowEditDialog(false); setDrawerClosing(false); }, 300); }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="users__btn-submit">
                  {editingUser ? t('common.save') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        danger
      />

      {showPathSelector && (
        <div className="users__modal-overlay" onClick={() => setShowPathSelector(false)}>
          <div className="users__modal" onClick={e => e.stopPropagation()}>
            <div className="users__modal-header">
              <h3>{t('users.selectRootPath', '选择根路径')}</h3>
              <button onClick={() => setShowPathSelector(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="users__modal-body">
              <div className="users__path-breadcrumb">
                <button onClick={() => loadDirs('/')}>根目录</button>
                {currentBrowsePath !== '/' && currentBrowsePath.split('/').filter(Boolean).map((part, index, arr) => (
                  <span key={index}>
                    <span className="separator">/</span>
                    <button onClick={() => loadDirs('/' + arr.slice(0, index + 1).join('/'))}>
                      {part}
                    </button>
                  </span>
                ))}
              </div>
              <div className="users__dir-list">
                {dirs.map(dir => (
                  <div 
                    key={dir.path} 
                    className="users__dir-item"
                    onClick={() => loadDirs(dir.path)}
                  >
                    <Folder size={18} />
                    <span>{dir.name}</span>
                  </div>
                ))}
                {dirs.length === 0 && (
                  <div className="users__dir-empty">
                    {t('users.noSubfolders', '没有子文件夹')}
                  </div>
                )}
              </div>
            </div>
            <div className="users__modal-footer">
              <span className="users__current-path">{currentBrowsePath}</span>
              <button onClick={() => handleSelectRootPath(currentBrowsePath)}>
                {t('users.confirmSelectPath', '选择此路径')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
