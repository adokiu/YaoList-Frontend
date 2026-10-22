import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2, X, Check, Folder, FolderOpen, Lock, EyeOff } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageLayout } from '../../components/PageLayout/PageLayout'
import { DataTable, type Column } from '../../components/DataTable/DataTable'
import { Button } from '../../components/Button/Button'
import { TableActions, TableCell, TableLinkButton } from '../../components/manage/tableCells'
import '../../styles/pages/metadata.scss'

interface Meta {
  id: number
  path: string
  password: string | null
  p_sub: boolean
  write: boolean
  w_sub: boolean
  hide: string | null
  h_sub: boolean
  readme: string | null
  r_sub: boolean
  header: string | null
  header_sub: boolean
  created_at: string
  updated_at: string
}

interface FormData {
  path: string
  password: string
  p_sub: boolean
  write: boolean
  w_sub: boolean
  hide: string
  h_sub: boolean
  readme: string
  r_sub: boolean
  header: string
  header_sub: boolean
}

const initialFormData: FormData = {
  path: '/',
  password: '',
  p_sub: false,
  write: false,
  w_sub: false,
  hide: '',
  h_sub: false,
  readme: '',
  r_sub: false,
  header: '',
  header_sub: false
}

export default function Metadata() {
  const { t } = useTranslation()
  const toast = useToast()
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showPathSelector, setShowPathSelector] = useState(false)
  const [dirs, setDirs] = useState<{name: string, path: string}[]>([])
  const [currentBrowsePath, setCurrentBrowsePath] = useState('/')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: number | null}>({show: false, id: null})

  useEffect(() => {
    loadMetas()
  }, [page, perPage])

  const loadMetas = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/metas?page=${page}&per_page=${perPage}`)
      if (response.data.code === 200) {
        setMetas(response.data.data.content || [])
        setTotal(response.data.data.total || 0)
      }
    } catch (err) {
      toast.error(t('metas.loadFailed') || '加载元信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDirs = async (path: string) => {
    try {
      // 使用管理后台专用接口，不受密码/隐藏限制
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

  const handleOpenDrawer = (meta?: Meta) => {
    if (meta) {
      setEditingMeta(meta)
      setFormData({
        path: meta.path,
        password: meta.password || '',
        p_sub: meta.p_sub,
        write: meta.write,
        w_sub: meta.w_sub,
        hide: meta.hide || '',
        h_sub: meta.h_sub,
        readme: meta.readme || '',
        r_sub: meta.r_sub,
        header: meta.header || '',
        header_sub: meta.header_sub
      })
    } else {
      setEditingMeta(null)
      setFormData(initialFormData)
    }
    setShowDrawer(true)
  }

  const handleCloseDrawer = () => {
    setDrawerClosing(true)
    setTimeout(() => {
      setShowDrawer(false)
      setDrawerClosing(false)
      setEditingMeta(null)
      setFormData(initialFormData)
    }, 300)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMeta) {
        await api.post(`/api/metas/${editingMeta.id}`, formData)
        toast.success(t('metas.updateSuccess') || '更新成功')
      } else {
        await api.post('/api/metas', formData)
        toast.success(t('metas.createSuccess') || '创建成功')
      }
      handleCloseDrawer()
      loadMetas()
    } catch (err) {
      toast.error(t('metas.saveFailed') || '保存失败')
    }
  }

  const handleDelete = (id: number) => {
    setDeleteConfirm({show: true, id})
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    setDeleteConfirm({show: false, id: null})
    try {
      await api.post(`/api/metas/${deleteConfirm.id}/delete`)
      toast.success(t('metas.deleteSuccess') || '删除成功')
      loadMetas()
    } catch (err) {
      toast.error(t('metas.deleteFailed') || '删除失败')
    }
  }

  const handleSelectPath = (path: string) => {
    setFormData({ ...formData, path })
    setShowPathSelector(false)
  }

  const previewText = (text: string, max = 20) =>
    text.length > max ? `${text.substring(0, max)}...` : text

  const columns: Column<Meta>[] = useMemo(
    () => [
      {
        key: 'path',
        title: t('metas.path') || '路径',
        render: (meta) => (
          <TableCell large>
            <div className="metadata__path-cell">
              <FolderOpen size={16} />
              <span>{meta.path}</span>
            </div>
          </TableCell>
        ),
      },
      {
        key: 'password',
        title: t('metas.password') || '密码',
        render: (meta) =>
          meta.password ? (
            <span className="metadata__badge metadata__badge--warning data-table-tag">
              <Lock size={12} />
              {meta.p_sub && <span className="metadata__sub-tag">+子</span>}
            </span>
          ) : (
            <span className="metadata__badge metadata__badge--muted">-</span>
          ),
      },
      {
        key: 'write',
        title: t('metas.write') || '写入',
        render: (meta) =>
          meta.write ? (
            <span className="metadata__badge metadata__badge--success data-table-tag">
              <Check size={12} />
              {meta.w_sub && <span className="metadata__sub-tag">+子</span>}
            </span>
          ) : (
            <span className="metadata__badge metadata__badge--muted">-</span>
          ),
      },
      {
        key: 'hide',
        title: t('metas.hide') || '隐藏',
        render: (meta) =>
          meta.hide ? (
            <span className="metadata__badge metadata__badge--info data-table-tag">
              <EyeOff size={12} />
              {meta.h_sub && <span className="metadata__sub-tag">+子</span>}
            </span>
          ) : (
            <span className="metadata__badge metadata__badge--muted">-</span>
          ),
      },
      {
        key: 'header',
        title: t('metas.header') || '顶部说明',
        render: (meta) =>
          meta.header ? (
            <TableCell>
              <span className="metadata__text-preview" title={meta.header}>
                {previewText(meta.header)}
                {meta.header_sub && <span className="metadata__sub-tag">+子</span>}
              </span>
            </TableCell>
          ) : (
            <span className="metadata__badge metadata__badge--muted">-</span>
          ),
      },
      {
        key: 'readme',
        title: t('metas.readme') || '说明',
        render: (meta) =>
          meta.readme ? (
            <TableCell>
              <span className="metadata__text-preview" title={meta.readme}>
                {previewText(meta.readme)}
                {meta.r_sub && <span className="metadata__sub-tag">+子</span>}
              </span>
            </TableCell>
          ) : (
            <span className="metadata__badge metadata__badge--muted">-</span>
          ),
      },
      {
        key: 'actions',
        title: t('common.operations') || '操作',
        render: (meta) => (
          <TableActions>
            <TableLinkButton onClick={() => handleOpenDrawer(meta)}>
              <Edit size={14} />
              {t('common.edit') || '编辑'}
            </TableLinkButton>
            <TableLinkButton danger onClick={() => handleDelete(meta.id)}>
              <Trash2 size={14} />
              {t('common.delete') || '删除'}
            </TableLinkButton>
          </TableActions>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="manage-page metadata">
      <PageLayout
        leftSlot={
          <p className="metadata__subtitle">
            {t('metas.description') ||
              '元信息内的配置对所有角色生效，如果想让用户有相应的权限请前往用户管理进行修改'}
          </p>
        }
        rightSlot={
          <Button size="sm" onClick={() => handleOpenDrawer()}>
            <Plus size={16} />
            {t('metas.add') || '添加'}
          </Button>
        }
      >
        <div className="manage-page__table-fill">
          <DataTable
            columns={columns}
            data={metas}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={t('metas.noMetas') || '暂无元信息'}
            tableClassName="data-table--entity-list"
            listLayoutId="metadata"
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
        <div className={`metadata__drawer-overlay ${drawerClosing ? 'metadata__drawer-overlay--closing' : ''}`} onClick={handleCloseDrawer}>
          <div className={`metadata__drawer ${drawerClosing ? 'metadata__drawer--closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="metadata__drawer-header">
              <h2>{editingMeta ? (t('metas.edit') || '编辑') : (t('metas.add') || '添加')}</h2>
              <button className="metadata__drawer-close" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="metadata__drawer-body">
                <div className="metadata__form-section">
                  <div className="metadata__form-field">
                  <label>{t('metas.path') || '路径'} <span className="required">*</span></label>
                  <div className="metadata__path-input">
                    <input
                      type="text"
                      value={formData.path}
                      onChange={e => setFormData({ ...formData, path: e.target.value })}
                      placeholder="/"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowPathSelector(true)
                        loadDirs('/')
                      }}
                    >
                      {t('metas.select') || '选择'}
                    </button>
                  </div>
                </div>

                <div className="metadata__form-field">
                  <label>{t('metas.password') || '密码'}</label>
                  <div className="metadata__field-with-checkbox">
                    <input
                      type="text"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder={t('metas.passwordPlaceholder') || '访问此路径需要的密码'}
                    />
                    <label className="metadata__checkbox">
                      <input
                        type="checkbox"
                        checked={formData.p_sub}
                        onChange={e => setFormData({ ...formData, p_sub: e.target.checked })}
                      />
                      <span>{t('metas.applySub') || '应用到子文件夹'}</span>
                    </label>
                  </div>
                </div>

                <div className="metadata__form-field">
                  <label>{t('metas.write') || '写入'}</label>
                  <div className="metadata__field-with-checkbox">
                    <label className="metadata__switch">
                      <input
                        type="checkbox"
                        checked={formData.write}
                        onChange={e => setFormData({ ...formData, write: e.target.checked })}
                      />
                      <span className="metadata__switch-slider"></span>
                    </label>
                    <label className="metadata__checkbox">
                      <input
                        type="checkbox"
                        checked={formData.w_sub}
                        onChange={e => setFormData({ ...formData, w_sub: e.target.checked })}
                      />
                      <span>{t('metas.applySub') || '应用到子文件夹'}</span>
                    </label>
                  </div>
                </div>

                <div className="metadata__form-field">
                  <label>{t('metas.hide') || '隐藏'}</label>
                  <div className="metadata__field-with-checkbox">
                    <textarea
                      value={formData.hide}
                      onChange={e => setFormData({ ...formData, hide: e.target.value })}
                      placeholder="正则表达式"
                      rows={2}
                    />
                    <label className="metadata__checkbox">
                      <input
                        type="checkbox"
                        checked={formData.h_sub}
                        onChange={e => setFormData({ ...formData, h_sub: e.target.checked })}
                      />
                      <span>{t('metas.applySub') || '应用到子文件夹'}</span>
                    </label>
                  </div>
                </div>

                <div className="metadata__form-field">
                  <label>{t('metas.header') || '顶部说明'}</label>
                  <div className="metadata__field-with-checkbox">
                    <textarea
                      value={formData.header}
                      onChange={e => setFormData({ ...formData, header: e.target.value })}
                      placeholder="Markdown"
                      rows={2}
                    />
                    <label className="metadata__checkbox">
                      <input
                        type="checkbox"
                        checked={formData.header_sub}
                        onChange={e => setFormData({ ...formData, header_sub: e.target.checked })}
                      />
                      <span>{t('metas.applySub') || '应用到子文件夹'}</span>
                    </label>
                  </div>
                </div>

                <div className="metadata__form-field">
                  <label>{t('metas.readme') || '说明'}</label>
                  <div className="metadata__field-with-checkbox">
                    <textarea
                      value={formData.readme}
                      onChange={e => setFormData({ ...formData, readme: e.target.value })}
                      placeholder="Markdown"
                      rows={2}
                    />
                    <label className="metadata__checkbox">
                      <input
                        type="checkbox"
                        checked={formData.r_sub}
                        onChange={e => setFormData({ ...formData, r_sub: e.target.checked })}
                      />
                      <span>{t('metas.applySub') || '应用到子文件夹'}</span>
                    </label>
                  </div>
                  </div>
                </div>
              </div>
              <div className="metadata__drawer-footer">
                <button type="button" className="metadata__btn-cancel" onClick={handleCloseDrawer}>
                  {t('common.cancel') || '取消'}
                </button>
                <button type="submit" className="metadata__btn-submit">
                  {editingMeta ? (t('common.save') || '保存') : (t('common.add') || '添加')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPathSelector && (
        <div className="metadata__modal-overlay" onClick={() => setShowPathSelector(false)}>
          <div className="metadata__modal" onClick={e => e.stopPropagation()}>
            <div className="metadata__modal-header">
              <h3>{t('metas.selectPath') || '选择路径'}</h3>
              <button onClick={() => setShowPathSelector(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="metadata__modal-body">
              <div className="metadata__path-breadcrumb">
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
              <div className="metadata__dir-list">
                {dirs.map(dir => (
                  <div 
                    key={dir.path} 
                    className="metadata__dir-item"
                    onClick={() => loadDirs(dir.path)}
                  >
                    <Folder size={18} />
                    <span>{dir.name}</span>
                  </div>
                ))}
                {dirs.length === 0 && (
                  <div className="metadata__dir-empty">
                    {t('metas.noSubfolders') || '没有子文件夹'}
                  </div>
                )}
              </div>
            </div>
            <div className="metadata__modal-footer">
              <span className="metadata__current-path">{currentBrowsePath}</span>
              <button onClick={() => handleSelectPath(currentBrowsePath)}>
                {t('metas.confirmSelect') || '选择此路径'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('metas.deleteTitle', '删除元信息')}
        message={t('metas.confirmDelete', '确定要删除此元信息吗？')}
        confirmText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({show: false, id: null})}
        danger
      />
    </div>
  )
}
