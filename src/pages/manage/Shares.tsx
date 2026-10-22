import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2, X, Copy, Check, Folder, File, Lock, Unlock } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageLayout } from '../../components/PageLayout/PageLayout'
import { DataTable, type Column } from '../../components/DataTable/DataTable'
import { SearchInput } from '../../components/SearchInput/SearchInput'
import { Button } from '../../components/Button/Button'
import { TableActions, TableCell, TableLinkButton } from '../../components/manage/tableCells'
import '../../styles/pages/shares.scss'

interface Share {
  id: number
  user_id: string | null
  short_id: string
  path: string
  name: string
  is_dir: boolean
  has_password: boolean
  expires_at: string | null
  max_access_count: number | null
  access_count: number
  enabled: boolean
  created_at: string
  updated_at: string
  creator_name: string | null
}

interface FormData {
  path: string
  password: string
  expires_at: string
  max_access_count: string
  enabled: boolean
}

const initialFormData: FormData = {
  path: '',
  password: '',
  expires_at: '',
  max_access_count: '',
  enabled: true
}

export default function Shares() {
  const { t } = useTranslation()
  const toast = useToast()
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [editingShare, setEditingShare] = useState<Share | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [showPathSelector, setShowPathSelector] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})
  const [files, setFiles] = useState<{name: string, path: string, is_dir: boolean}[]>([])
  const [currentBrowsePath, setCurrentBrowsePath] = useState('/')

  useEffect(() => {
    loadShares()
  }, [page, perPage, search])

  const loadShares = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/shares?page=${page}&per_page=${perPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      setShares(response.data.data || [])
      setTotal(response.data.total || 0)
    } catch (err) {
      toast.error(t('shares.loadFailed', '加载失败'))
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (path: string) => {
    try {
      const response = await api.post('/api/admin/fs/list', { path: path || '/' })
      if (response.data.code === 200) {
        const allFiles = response.data.data?.content || []
        const fileList = allFiles.map((f: any) => ({
          name: f.name,
          path: path === '/' ? `/${f.name}` : `${path}/${f.name}`,
          is_dir: f.is_dir
        }))
        fileList.sort((a: any, b: any) => {
          if (a.is_dir && !b.is_dir) return -1
          if (!a.is_dir && b.is_dir) return 1
          return a.name.localeCompare(b.name)
        })
        setFiles(fileList)
        setCurrentBrowsePath(path)
      }
    } catch (err) {
      console.error('加载文件列表失败:', err)
    }
  }

  const handleSelectFile = (file: {name: string, path: string, is_dir: boolean}) => {
    if (file.is_dir) {
      loadFiles(file.path)
    } else {
      setFormData({ ...formData, path: file.path })
      setShowPathSelector(false)
    }
  }

  const handleSelectDir = () => {
    setFormData({ ...formData, path: currentBrowsePath })
    setShowPathSelector(false)
  }

  const handleOpenDrawer = (share?: Share) => {
    if (share) {
      setEditingShare(share)
      setFormData({
        path: share.path,
        password: '',
        expires_at: share.expires_at || '',
        max_access_count: share.max_access_count?.toString() || '',
        enabled: share.enabled
      })
    } else {
      setEditingShare(null)
      setFormData(initialFormData)
    }
    setShowDrawer(true)
  }

  const handleCloseDrawer = () => {
    setDrawerClosing(true)
    setTimeout(() => {
      setShowDrawer(false)
      setDrawerClosing(false)
      setEditingShare(null)
      setFormData(initialFormData)
    }, 300)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        path: formData.path,
        password: formData.password || null,
        expires_at: formData.expires_at || null,
        max_access_count: formData.max_access_count ? parseInt(formData.max_access_count) : null,
        enabled: formData.enabled
      }
      
      if (editingShare) {
        await api.post(`/api/shares/${editingShare.id}`, data)
        toast.success(t('shares.updateSuccess', '更新成功'))
      } else {
        await api.post('/api/shares', data)
        toast.success(t('shares.createSuccess', '创建成功'))
      }
      handleCloseDrawer()
      loadShares()
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('shares.operationFailed', '操作失败'))
    }
  }

  const handleDelete = (id: number) => {
    setDeleteConfirm({show: true, id})
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    setDeleteConfirm({show: false, id: null})
    try {
      await api.post(`/api/shares/${deleteConfirm.id}/delete`)
      toast.success(t('shares.deleteSuccess', '删除成功'))
      loadShares()
    } catch (err) {
      toast.error(t('shares.deleteFailed', '删除失败'))
    }
  }

  const handleToggle = async (id: number) => {
    try {
      const response = await api.post(`/api/shares/${id}/toggle`)
      toast.success(response.data.message)
      loadShares()
    } catch (err) {
      toast.error(t('shares.operationFailed', '操作失败'))
    }
  }

  const copyLink = (share: Share) => {
    const url = `${window.location.origin}/share/${share.short_id}`
    navigator.clipboard.writeText(url)
    setCopiedId(share.id)
    toast.success(t('shares.copied', '已复制到剪贴板'))
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const isExpired = (share: Share) => {
    if (!share.expires_at) return false
    return new Date(share.expires_at) < new Date()
  }

  const isExhausted = (share: Share) => {
    if (!share.max_access_count) return false
    return share.access_count >= share.max_access_count
  }

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const columns: Column<Share>[] = useMemo(
    () => [
      {
        key: 'creator',
        title: t('shares.creator', '创建者'),
        render: (share) => (
          <TableCell>{share.creator_name || t('shares.guest', '游客')}</TableCell>
        ),
      },
      {
        key: 'name',
        title: t('shares.name', '名称'),
        render: (share) => (
          <TableCell large>
            <div className="shares__name">
              {share.is_dir ? <Folder size={14} /> : <File size={14} />}
              <span title={share.name}>{share.name}</span>
            </div>
          </TableCell>
        ),
      },
      {
        key: 'path',
        title: t('shares.path', '路径'),
        render: (share) => (
          <TableCell>
            <span className="shares__path" title={share.path}>
              {share.path}
            </span>
          </TableCell>
        ),
      },
      {
        key: 'password',
        title: t('shares.password', '密码'),
        render: (share) => (
          <span className={`shares__password ${share.has_password ? 'shares__password--set' : ''}`}>
            {share.has_password ? <Lock size={14} /> : <Unlock size={14} />}
          </span>
        ),
      },
      {
        key: 'created_at',
        title: t('shares.createdAt', '创建时间'),
        render: (share) => <TableCell>{formatDate(share.created_at)}</TableCell>,
      },
      {
        key: 'expires_at',
        title: t('shares.expiresAt', '到期时间'),
        render: (share) => (
          <TableCell>
            {share.expires_at ? formatDate(share.expires_at) : t('shares.never', '永久')}
          </TableCell>
        ),
      },
      {
        key: 'access_count',
        title: t('shares.count', '次数'),
        render: (share) => (
          <TableCell>
            {share.access_count}/{share.max_access_count ?? '∞'}
          </TableCell>
        ),
      },
      {
        key: 'status',
        title: t('shares.status', '状态'),
        render: (share) => (
          <span
            className={`shares__badge shares__badge--clickable data-table-tag ${
              !share.enabled
                ? 'shares__badge--disabled'
                : isExpired(share)
                  ? 'shares__badge--expired'
                  : isExhausted(share)
                    ? 'shares__badge--exhausted'
                    : 'shares__badge--active'
            }`}
            onClick={() => handleToggle(share.id)}
            title={t('shares.clickToToggle', '点击切换')}
          >
            {!share.enabled
              ? t('shares.disabled', '禁用')
              : isExpired(share)
                ? t('shares.expired', '过期')
                : isExhausted(share)
                  ? t('shares.exhausted', '耗尽')
                  : t('shares.active', '正常')}
          </span>
        ),
      },
      {
        key: 'actions',
        title: t('common.actions', '操作'),
        render: (share) => (
          <TableActions>
            <TableLinkButton onClick={() => copyLink(share)}>
              {copiedId === share.id ? <Check size={14} /> : <Copy size={14} />}
              {t('shares.copyLink', '复制链接')}
            </TableLinkButton>
            <TableLinkButton onClick={() => handleOpenDrawer(share)}>
              <Edit size={14} />
              {t('common.edit', '编辑')}
            </TableLinkButton>
            <TableLinkButton danger onClick={() => handleDelete(share.id)}>
              <Trash2 size={14} />
              {t('common.delete', '删除')}
            </TableLinkButton>
          </TableActions>
        ),
      },
    ],
    [t, copiedId],
  )

  return (
    <div className="manage-page shares__container">
      <PageLayout
        leftSlot={
          <SearchInput
            value={search}
            placeholder={t('shares.searchPlaceholder', '搜索...')}
            onChange={handleSearch}
          />
        }
        rightSlot={
          <Button size="sm" onClick={() => handleOpenDrawer()}>
            <Plus size={16} />
            {t('shares.add', '新建')}
          </Button>
        }
      >
        <div className="manage-page__table-fill">
          <DataTable
            columns={columns}
            data={shares}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={t('shares.empty', '暂无分享')}
            tableClassName="data-table--entity-list"
            listLayoutId="shares"
            pagination={{ page, size: perPage, total }}
            onPageChange={setPage}
            onSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
        </div>
      </PageLayout>

      {showDrawer && (
        <div className={`shares__drawer-overlay ${drawerClosing ? 'shares__drawer-overlay--closing' : ''}`} onClick={handleCloseDrawer}>
          <div className={`shares__drawer ${drawerClosing ? 'shares__drawer--closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="shares__drawer-header">
              <h2>{editingShare ? t('shares.edit', '编辑分享') : t('shares.create', '新建分享')}</h2>
              <button className="shares__drawer-close" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="shares__drawer-body">
                <div className="shares__form-field">
                  <label>{t('shares.pathLabel', '文件/文件夹路径')} <span className="required">*</span></label>
                  <div className="shares__path-input">
                    <input
                      type="text"
                      value={formData.path}
                      onChange={e => setFormData({ ...formData, path: e.target.value })}
                      placeholder="/path/to/file"
                      required
                      disabled={!!editingShare}
                    />
                    {!editingShare && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowPathSelector(true)
                          loadFiles('/')
                        }}
                      >
                        {t('shares.select', '选择')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="shares__form-field">
                  <label>{t('shares.passwordLabel', '提取码')}</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingShare ? t('shares.keepPassword', '留空保持原密码，输入新值则更新') : t('shares.noPassword', '留空表示无需密码')}
                  />
                </div>

                <div className="shares__form-field">
                  <label>{t('shares.expiresAtLabel', '过期时间')}</label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                  <span className="shares__hint">{t('shares.expiresHint', '留空表示永不过期')}</span>
                </div>

                <div className="shares__form-field">
                  <label>{t('shares.maxAccessLabel', '最大访问次数')}</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_access_count}
                    onChange={e => setFormData({ ...formData, max_access_count: e.target.value })}
                    placeholder={t('shares.unlimited', '不限制')}
                  />
                  <span className="shares__hint">{t('shares.maxAccessHint', '留空表示不限制访问次数')}</span>
                </div>

                <div className="shares__form-switches">
                  <label className="shares__switch-label">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                    <span>{t('shares.enableShare', '启用分享')}</span>
                  </label>
                </div>
              </div>

              <div className="shares__drawer-footer">
                <button type="button" className="shares__btn-cancel" onClick={handleCloseDrawer}>
                  {t('common.cancel', '取消')}
                </button>
                <button type="submit" className="shares__btn-submit">
                  {editingShare ? t('common.save', '保存') : t('common.create', '创建')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPathSelector && (
        <div className="shares__modal-overlay" onClick={() => setShowPathSelector(false)}>
          <div className="shares__modal" onClick={e => e.stopPropagation()}>
            <div className="shares__modal-header">
              <h3>{t('shares.selectPath', '选择文件/文件夹')}</h3>
              <button onClick={() => setShowPathSelector(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="shares__modal-body">
              <div className="shares__path-breadcrumb">
                <button onClick={() => loadFiles('/')}>{t('shares.root', '根目录')}</button>
                {currentBrowsePath !== '/' && currentBrowsePath.split('/').filter(Boolean).map((part, index, arr) => (
                  <span key={index}>
                    <span className="separator">/</span>
                    <button onClick={() => loadFiles('/' + arr.slice(0, index + 1).join('/'))}>
                      {part}
                    </button>
                  </span>
                ))}
              </div>
              <div className="shares__file-list">
                {files.map(file => (
                  <div 
                    key={file.path} 
                    className={`shares__file-item ${file.is_dir ? 'shares__file-item--dir' : ''}`}
                    onClick={() => handleSelectFile(file)}
                  >
                    {file.is_dir ? <Folder size={18} /> : <File size={18} />}
                    <span>{file.name}</span>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="shares__file-empty">
                    {t('shares.emptyDir', '此目录为空')}
                  </div>
                )}
              </div>
            </div>
            <div className="shares__modal-footer">
              <span className="shares__current-path">{currentBrowsePath}</span>
              <div className="shares__modal-buttons">
                <button type="button" className="shares__select-dir-btn" onClick={handleSelectDir}>
                  {t('shares.selectThisDir', '选择当前目录')}
                </button>
                <button type="button" onClick={() => setShowPathSelector(false)}>
                  {t('common.close', '关闭')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('shares.deleteTitle', '删除分享')}
        message={t('shares.confirmDelete', '确定要删除此分享吗？')}
        confirmText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({show: false, id: null})}
        danger
      />
    </div>
  )
}
