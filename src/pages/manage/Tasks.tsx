import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  RefreshCw, 
  Trash2, 
  Pause, 
  Play, 
  X, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  FileArchive,
  Upload,
  Download,
  Copy,
  Move,
  FolderInput,
  ChevronDown,
  Check
} from 'lucide-react'
import { api } from '../../utils/api'
import { useTaskEventsSse, type SidebarTask } from '../../utils/taskEventsSse'
import { PageLayout } from '../../components/PageLayout/PageLayout'
import { DataTable, type Column } from '../../components/DataTable/DataTable'
import { Button } from '../../components/Button/Button'
import { TableActions, TableCell, TableLinkButton } from '../../components/manage/tableCells'
import '../../styles/components/tasks.scss'

interface Task {
  id: string
  task_type: string
  status: string
  name: string
  source_path: string
  target_path: string | null
  total_size: number
  processed_size: number
  total_files: number
  processed_files: number
  progress: number
  speed: number
  eta_seconds: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  user_id: string | null
  username: string
  current_file: string | null
  upload_phase?: string
  openlist_status?: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Filters {
  taskType: string
  status: string
}

export default function Tasks() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState<Filters>({ taskType: '', status: '' })
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const patchTaskFromSse = useCallback((patch: SidebarTask, _eventType: string) => {
    setTasks((prev) =>
      prev.map((row) =>
        row.id === patch.id
          ? {
              ...row,
              progress: patch.progress,
              processed_size: patch.processed_size,
              total_size: patch.total_size,
              processed_files: patch.processed_files,
              total_files: patch.total_files,
              speed: patch.speed,
              eta_seconds: patch.eta_seconds ?? null,
              status: patch.status,
              current_file: patch.current_file ?? null,
              upload_phase: patch.upload_phase,
              openlist_status: patch.openlist_status,
              error: patch.error ?? null,
              finished_at: patch.finished_at ?? row.finished_at,
              started_at: patch.started_at ?? row.started_at,
            }
          : row,
      ),
    )
  }, [])

  useTaskEventsSse(
    true,
    () => {},
    { snapshotMode: 'ignore', onTaskPatch: patchTaskFromSse },
  )
  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node) &&
          statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/tasks/list', {
        page: pagination.page,
        page_size: pagination.pageSize,
        task_type: filters.taskType || undefined,
        status: filters.status || undefined,
      })
      if (response.data.data) {
        setTasks(response.data.data.tasks || [])
        setIsAdmin(response.data.data.is_admin || false)
        setPagination(prev => ({
          ...prev,
          total: response.data.data.total || 0,
          totalPages: response.data.data.total_pages || 0
        }))
      }
    } catch (error) {
      console.error('加载任务列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, filters])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const cancelTask = async (taskId: string) => {
    try {
      await api.post('/api/tasks/cancel', { task_id: taskId })
    } catch (error) {
      console.error('取消任务失败:', error)
    }
  }

  const pauseTask = async (taskId: string) => {
    try {
      await api.post('/api/tasks/pause', { task_id: taskId })
    } catch (error) {
      console.error('暂停任务失败:', error)
    }
  }

  const resumeTask = async (taskId: string) => {
    try {
      await api.post('/api/tasks/resume', { task_id: taskId })
    } catch (error) {
      console.error('继续任务失败:', error)
    }
  }

  const retryTask = async (taskId: string) => {
    try {
      await api.post('/api/tasks/retry', { task_id: taskId })
    } catch (error) {
      console.error('重试任务失败:', error)
    }
  }

  const removeTask = async (taskId: string) => {
    try {
      await api.post('/api/tasks/remove', { task_id: taskId })
      loadTasks()
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }

  const clearCompleted = async () => {
    try {
      await api.post('/api/tasks/clear')
      loadTasks()
    } catch (error) {
      console.error('清除完成任务失败:', error)
    }
  }

  const clearAllCompleted = async () => {
    try {
      await api.post('/api/tasks/clear_all')
      loadTasks()
    } catch (error) {
      console.error('清除所有完成任务失败:', error)
    }
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatSize(bytesPerSecond) + '/s'
  }

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--'
    return new Date(isoString).toLocaleString('zh-CN')
  }

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'extract': return <FileArchive size={16} />
      case 'upload': return <Upload size={16} />
      case 'download': return <Download size={16} />
      case 'copy': return <Copy size={16} />
      case 'move': return <Move size={16} />
      default: return <FolderInput size={16} />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="tasks__status-icon tasks__status-icon--pending" />
      case 'running': return <Loader2 size={14} className="tasks__status-icon tasks__status-icon--running" />
      case 'completed': return <CheckCircle size={14} className="tasks__status-icon tasks__status-icon--completed" />
      case 'failed': return <AlertCircle size={14} className="tasks__status-icon tasks__status-icon--failed" />
      case 'cancelled': return <X size={14} className="tasks__status-icon tasks__status-icon--cancelled" />
      case 'paused': return <Pause size={14} className="tasks__status-icon tasks__status-icon--paused" />
      case 'interrupted': return <AlertCircle size={14} className="tasks__status-icon tasks__status-icon--interrupted" />
      default: return null
    }
  }

  const getStatusText = (status: string) => {
    const key = status.toLowerCase()
    return t(`tasks.statuses.${key}`, status)
  }

  const getTaskTypeText = (taskType: string) => {
    const key = taskType.toLowerCase()
    return t(`tasks.types.${key}`, taskType)
  }

  const getRunningStatusLabel = (task: Task) => {
    if (
      task.task_type === 'upload' &&
      (task.status === 'running' || task.status === 'paused')
    ) {
      // 统一进度后上传只有一个进行中状态。
      return t('taskSidebar.statusUploading', { defaultValue: '上传中' })
    }
    return getStatusText(task.status)
  }

  const columns: Column<Task>[] = useMemo(
    () => [
      {
        key: 'type',
        title: t('tasks.taskType'),
        render: (task) => (
          <TableCell>
            <div className="tasks__cell-type">
              {getTaskIcon(task.task_type)}
              <span>{getTaskTypeText(task.task_type)}</span>
            </div>
          </TableCell>
        ),
      },
      {
        key: 'status',
        title: t('tasks.status'),
        render: (task) => (
          <span className={`tasks__status-badge data-table-tag tasks__status-badge--${task.status}`}>
            {getStatusIcon(task.status)}
            <span>{getRunningStatusLabel(task)}</span>
          </span>
        ),
      },
      {
        key: 'name',
        title: t('tasks.taskName'),
        render: (task) => (
          <TableCell large>
            <div className="tasks__cell-name" title={task.name}>
              {task.name}
              {task.error && (
                <span className="tasks__error-hint" title={task.error}>
                  <AlertCircle size={12} />
                </span>
              )}
            </div>
          </TableCell>
        ),
      },
      {
        key: 'source_path',
        title: t('tasks.sourcePath'),
        render: (task) => (
          <TableCell>
            <span className="tasks__cell-path" title={task.source_path || '--'}>
              {task.source_path || '--'}
            </span>
          </TableCell>
        ),
      },
      {
        key: 'target_path',
        title: t('tasks.targetPath'),
        render: (task) => (
          <TableCell>
            <span className="tasks__cell-path" title={task.target_path || '--'}>
              {task.target_path || '--'}
            </span>
          </TableCell>
        ),
      },
      {
        key: 'progress',
        title: t('tasks.progress'),
        render: (task) => (
          <TableCell>
            <div className="tasks__cell-progress">
              <div className="tasks__mini-progress">
                <div
                  className={`tasks__mini-progress-fill tasks__mini-progress-fill--${task.status}`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="tasks__progress-text">{task.progress.toFixed(1)}%</span>
              {task.status === 'running' && task.speed > 0 && (
                <span className="tasks__speed">{formatSpeed(task.speed)}</span>
              )}
            </div>
          </TableCell>
        ),
      },
      {
        key: 'creator',
        title: t('tasks.creator'),
        render: (task) => <TableCell>{task.username}</TableCell>,
      },
      {
        key: 'created_at',
        title: t('tasks.createdAt'),
        render: (task) => <TableCell>{formatTime(task.created_at)}</TableCell>,
      },
      {
        key: 'actions',
        title: t('tasks.actions'),
        render: (task) => (
          <TableActions>
            {task.status === 'paused' ? (
              <TableLinkButton onClick={() => resumeTask(task.id)}>
                <Play size={14} />
              </TableLinkButton>
            ) : (
              <TableLinkButton
                onClick={() => pauseTask(task.id)}
                disabled={task.status !== 'running'}
              >
                <Pause size={14} />
              </TableLinkButton>
            )}
            <TableLinkButton
              danger
              onClick={() => cancelTask(task.id)}
              disabled={!['running', 'paused', 'pending'].includes(task.status)}
            >
              <X size={14} />
            </TableLinkButton>
            <TableLinkButton
              onClick={() => retryTask(task.id)}
              disabled={!['failed', 'interrupted'].includes(task.status)}
            >
              <RotateCcw size={14} />
            </TableLinkButton>
            <TableLinkButton danger onClick={() => removeTask(task.id)}>
              <Trash2 size={14} />
            </TableLinkButton>
          </TableActions>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="manage-page tasks">
      <PageLayout
        rightSlot={
          <>
            <Button size="sm" variant="secondary" onClick={() => loadTasks()}>
              <RefreshCw size={16} />
              {t('tasks.refresh')}
            </Button>
            <Button size="sm" variant="secondary" onClick={clearCompleted}>
              <Trash2 size={16} />
              {t('tasks.clearCompleted')}
            </Button>
            {isAdmin && (
              <Button size="sm" variant="danger" onClick={clearAllCompleted}>
                <Trash2 size={16} />
                {t('tasks.clearAllCompleted')}
              </Button>
            )}
          </>
        }
      >
      <div className="tasks__toolbar">
        <div className="tasks__filter-row">
          {/* 任务类型下拉 */}
          <div className="tasks__select-group" ref={typeDropdownRef}>
            <label>{t('tasks.taskType')}</label>
            <div 
              className={`tasks__dropdown ${openDropdown === 'type' ? 'tasks__dropdown--open' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
            >
              <span className="tasks__dropdown-value">
                {filters.taskType ? t(`tasks.types.${filters.taskType.toLowerCase()}`) : t('tasks.all')}
              </span>
              <ChevronDown size={16} className="tasks__dropdown-arrow" />
              {openDropdown === 'type' && (
                <div className="tasks__dropdown-menu">
                  {[
                    { value: '', label: t('tasks.all') },
                    { value: 'extract', label: t('tasks.types.extract') },
                    { value: 'upload', label: t('tasks.types.upload') },
                    { value: 'download', label: t('tasks.types.download') },
                    { value: 'copy', label: t('tasks.types.copy') },
                    { value: 'move', label: t('tasks.types.move') },
                  ].map(option => (
                    <div 
                      key={option.value}
                      className={`tasks__dropdown-item ${filters.taskType === option.value ? 'tasks__dropdown-item--selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFilterChange('taskType', option.value)
                        setOpenDropdown(null)
                      }}
                    >
                      <span>{option.label}</span>
                      {filters.taskType === option.value && <Check size={14} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 状态下拉 */}
          <div className="tasks__select-group" ref={statusDropdownRef}>
            <label>{t('tasks.status')}</label>
            <div 
              className={`tasks__dropdown ${openDropdown === 'status' ? 'tasks__dropdown--open' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            >
              <span className="tasks__dropdown-value">
                {filters.status ? t(`tasks.statuses.${filters.status.toLowerCase()}`) : t('tasks.all')}
              </span>
              <ChevronDown size={16} className="tasks__dropdown-arrow" />
              {openDropdown === 'status' && (
                <div className="tasks__dropdown-menu">
                  {[
                    { value: '', label: t('tasks.all') },
                    { value: 'pending', label: t('tasks.statuses.pending') },
                    { value: 'running', label: t('tasks.statuses.running') },
                    { value: 'completed', label: t('tasks.statuses.completed') },
                    { value: 'failed', label: t('tasks.statuses.failed') },
                    { value: 'cancelled', label: t('tasks.statuses.cancelled') },
                    { value: 'paused', label: t('tasks.statuses.paused') },
                    { value: 'interrupted', label: t('tasks.statuses.interrupted') },
                  ].map(option => (
                    <div 
                      key={option.value}
                      className={`tasks__dropdown-item ${filters.status === option.value ? 'tasks__dropdown-item--selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFilterChange('status', option.value)
                        setOpenDropdown(null)
                      }}
                    >
                      <span>{option.label}</span>
                      {filters.status === option.value && <Check size={14} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="tasks__filter-info">
            {t('tasks.totalRecords', { count: pagination.total })}
          </div>
        </div>
      </div>

        <div className="manage-page__table-fill">
          <DataTable
            columns={columns}
            data={tasks}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={t('tasks.noTasks')}
            tableClassName="data-table--entity-list"
            listLayoutId="tasks"
            pagination={{
              page: pagination.page,
              size: pagination.pageSize,
              total: pagination.total,
            }}
            onPageChange={(nextPage) => setPagination((prev) => ({ ...prev, page: nextPage }))}
            onSizeChange={(size) =>
              setPagination((prev) => ({ ...prev, pageSize: size, page: 1 }))
            }
          />
        </div>
      </PageLayout>
    </div>
  )
}
