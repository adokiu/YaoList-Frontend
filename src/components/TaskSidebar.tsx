import { useState, useEffect, useRef, useCallback } from 'react'
import { useTaskEventsSse, type SidebarTask } from '../utils/taskEventsSse'
import { X, Upload, Download, Copy, Move, Trash2, CheckCircle, XCircle, Clock, Loader2, Archive, Pause, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import '../styles/components/task-sidebar.scss'

type Task = SidebarTask & { user_id?: number }

interface TaskSidebarProps {
  visible: boolean
  onClose: () => void
  alwaysConnect?: boolean
  onResumeUpload?: (taskId: string, targetPath: string, pendingFiles: any[]) => void
  onCancelUpload?: (taskId: string) => void  // 取消前端上传任务
}

export default function TaskSidebar({ visible, onClose, alwaysConnect = false, onResumeUpload, onCancelUpload }: TaskSidebarProps) {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>([])
  const handleTasks = useCallback((list: SidebarTask[]) => {
    setTasks(list as Task[])
  }, [])
  useTaskEventsSse(alwaysConnect || visible, handleTasks)
  const [showExactTime, setShowExactTime] = useState<Record<string, boolean>>({}) // 记录哪些任务显示具体时间
  const [isClosing, setIsClosing] = useState(false) // 关闭动画状态
  const [shouldRender, setShouldRender] = useState(false) // 是否应该渲染

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

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
  }

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number) => {
    return formatSize(bytesPerSecond) + '/s'
  }

  // 格式化ETA
  const formatEta = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }

  // 格式化完成时间（相对时间）
  const formatFinishedTimeRelative = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return t('taskSidebar.justNow')
    if (diff < 3600000) return t('taskSidebar.minutesAgo', { count: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('taskSidebar.hoursAgo', { count: Math.floor(diff / 3600000) })
    if (diff < 604800000) return t('taskSidebar.daysAgo', { count: Math.floor(diff / 86400000) })
    
    const lang = localStorage.getItem('language') || 'zh-CN'
    return date.toLocaleDateString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // 格式化完成时间（具体时间）
  const formatFinishedTimeExact = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const lang = localStorage.getItem('language') || 'zh-CN'
    return date.toLocaleString(lang, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // 切换时间显示模式
  const toggleTimeDisplay = (taskId: string) => {
    setShowExactTime(prev => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  // 获取任务描述文本（包含目录路径）
  const getTaskDescription = (task: Task, showFullPath: boolean = false) => {
    const targetDir = task.target_path || task.source_path || '/'
    const shortDir = showFullPath ? targetDir : (targetDir.length > 15 ? '...' + targetDir.slice(-15) : targetDir)
    
    switch (task.task_type) {
      case 'upload':
        return t('taskSidebar.uploadTo', { name: task.name, dir: shortDir })
      case 'download':
        return t('taskSidebar.downloadFrom', { name: task.name, dir: shortDir })
      case 'copy':
        return t('taskSidebar.copyTo', { name: task.name, dir: shortDir })
      case 'move':
        return t('taskSidebar.moveTo', { name: task.name, dir: shortDir })
      case 'delete':
        return t('taskSidebar.deleteFrom', { name: task.name, dir: shortDir })
      case 'extract':
        return t('taskSidebar.extractTo', { name: task.name, dir: shortDir })
      default:
        return task.name
    }
  }

  // 获取目标路径
  const getTargetPath = (task: Task) => {
    return task.target_path || task.source_path || '/'
  }

  // 获取任务图标
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'upload': return <Upload size={16} />
      case 'download': return <Download size={16} />
      case 'copy': return <Copy size={16} />
      case 'move': return <Move size={16} />
      case 'delete': return <Trash2 size={16} />
      case 'extract': return <Archive size={16} />
      default: return <Upload size={16} />
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="task-sidebar__status-icon task-sidebar__status-icon--pending" />
      case 'running': return <Loader2 size={14} className="task-sidebar__status-icon task-sidebar__status-icon--running" />
      case 'completed': return <CheckCircle size={14} className="task-sidebar__status-icon task-sidebar__status-icon--completed" />
      case 'failed': return <XCircle size={14} className="task-sidebar__status-icon task-sidebar__status-icon--failed" />
      case 'cancelled': return <XCircle size={14} className="task-sidebar__status-icon task-sidebar__status-icon--cancelled" />
      case 'interrupted': return <Clock size={14} className="task-sidebar__status-icon task-sidebar__status-icon--interrupted" />
      default: return null
    }
  }
  
  // 获取状态文本
  const uploadActivityLabel = (task: Task) => {
    if (task.upload_phase === 'backending') {
      return t('taskSidebar.statusBackending', { defaultValue: '写入存储' })
    }
    if (task.upload_phase === 'uploading') {
      return t('taskSidebar.statusUploading', { defaultValue: '上传中' })
    }
    if (task.openlist_status === 'backending') {
      return t('taskSidebar.statusBackending', { defaultValue: '写入存储' })
    }
    if (task.openlist_status === 'uploading') {
      return t('taskSidebar.statusUploading', { defaultValue: '上传中' })
    }
    return task.openlist_status || getStatusText(task.status)
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('taskSidebar.statusPending')
      case 'running': return t('taskSidebar.statusRunning')
      case 'paused': return t('taskSidebar.statusPaused')
      case 'completed': return t('taskSidebar.statusCompleted')
      case 'failed': return t('taskSidebar.statusFailed')
      case 'cancelled': return t('taskSidebar.statusCancelled')
      case 'interrupted': return t('taskSidebar.statusInterrupted')
      default: return status
    }
  }
  
  // 暂停任务
  const handlePauseTask = async (taskId: string) => {
    try {
      await fetch('/api/tasks/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
        credentials: 'include'
      })
    } catch (e) {
      console.error('Failed to pause task:', e)
    }
  }
  
  // 继续任务
  const handleResumeTask = async (taskId: string) => {
    try {
      await fetch('/api/tasks/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
        credentials: 'include'
      })
    } catch (e) {
      console.error('Failed to resume task:', e)
    }
  }

  // 清除已完成任务（保留运行中和中断的任务）
  const handleClearCompleted = async () => {
    try {
      await fetch('/api/tasks/clear', { method: 'POST' })
      setTasks(prev => prev.filter(t => 
        t.status === 'pending' || t.status === 'running' || t.status === 'interrupted'
      ))
    } catch (e) {
      console.error('Failed to clear tasks:', e)
    }
  }

  // 取消任务
  const handleCancelTask = async (taskId: string, taskType?: string) => {
    try {
      if (taskType === 'upload') {
        onCancelUpload?.(taskId)
        await fetch(`/api/task/upload/cancel?tid=${encodeURIComponent(taskId)}`, {
          method: 'POST',
          credentials: 'include',
        })
        return
      }
      await fetch('/api/tasks/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ task_id: taskId }),
      })
    } catch (e) {
      console.error('Failed to cancel task:', e)
    }
  }

  // 继续上传（断点续传）
  const handleRetryTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 && data.data) {
          const { target_path, pending_files } = data.data
          if (onResumeUpload && pending_files?.length > 0) {
            onResumeUpload(taskId, target_path, pending_files)
          }
        }
        console.log('Task resumed:', taskId)
      }
    } catch (e) {
      console.error('Failed to resume task:', e)
    }
  }

  // 重新启动任务（复制/移动/解压等非上传任务）
  const handleRestartTask = async (taskId: string) => {
    try {
      await fetch('/api/tasks/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId })
      })
    } catch (e) {
      console.error('Failed to restart task:', e)
    }
  }

  // 删除任务
  const handleRemoveTask = async (taskId: string) => {
    try {
      await fetch('/api/tasks/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId })
      })
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e) {
      console.error('Failed to remove task:', e)
    }
  }

  // 分类任务
  const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending' || t.status === 'paused')
  const interruptedTasks = tasks.filter(t => t.status === 'interrupted')
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')

  if (!shouldRender) return null

  return (
    <div className={`task-sidebar ${isClosing ? 'task-sidebar--closing' : ''}`}>
      <div className="task-sidebar__header">
        <h3>{t('fileBrowser.taskList')}</h3>
        <button className="task-sidebar__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      <div className="task-sidebar__content">
        {/* 进行中的任务 */}
        {runningTasks.length > 0 && (
          <div className="task-sidebar__section">
            <div className="task-sidebar__section-title">
              {t('fileBrowser.runningTasks')} ({runningTasks.length})
            </div>
            {runningTasks.map(task => (
              <div key={task.id} className={`task-sidebar__item task-sidebar__item--${task.status}`}>
                <div className="task-sidebar__item-header">
                  <div className="task-sidebar__item-icon">
                    {getTaskIcon(task.task_type)}
                  </div>
                  <div className="task-sidebar__item-info-wrapper">
                    <div className="task-sidebar__item-name" title={task.name}>
                      {task.name}
                    </div>
                    <div className="task-sidebar__item-path" title={getTargetPath(task)}>
                      → {getTargetPath(task).length > 25 ? '...' + getTargetPath(task).slice(-25) : getTargetPath(task)}
                    </div>
                  </div>
                  {(task.status === 'running' || task.status === 'paused') && (
                    <div className="task-sidebar__item-controls">
                      {task.status === 'running' ? (
                        <button 
                          className="task-sidebar__item-btn-icon"
                          onClick={() => handlePauseTask(task.id)}
                          title={t('taskSidebar.pause')}
                        >
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button 
                          className="task-sidebar__item-btn-icon"
                          onClick={() => handleResumeTask(task.id)}
                          title={t('taskSidebar.resume')}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button 
                        className="task-sidebar__item-btn-icon task-sidebar__item-btn-icon--danger"
                        onClick={() => handleCancelTask(task.id, task.task_type)}
                        title={t('taskSidebar.stop')}
                      >
                        <Square size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="task-sidebar__item-progress">
                  <div 
                    className="task-sidebar__item-progress-bar"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                {task.current_file && task.status === 'running' && (
                  <div className="task-sidebar__item-current">
                    {(() => {
                      // 解析 [阶段] 文件名 格式
                      const match = task.current_file.match(/^\[(.+?)\]\s*(.*)$/)
                      if (match) {
                        const phase = match[1]
                        const filename = match[2]
                        const displayName = filename.length > 25 ? filename.slice(0, 25) + '...' : filename
                        return <>{t('taskSidebar.current')}: <span className="task-sidebar__item-phase">[{phase}]</span> {displayName}</>
                      }
                      return `${t('taskSidebar.current')}: ${task.current_file.length > 30 ? task.current_file.slice(0, 30) + '...' : task.current_file}`
                    })()}
                  </div>
                )}
                <div className="task-sidebar__item-info">
                  <span className="task-sidebar__item-size">
                    {task.task_type === 'extract' ? (
                      // 解压任务显示文件数
                      t('taskSidebar.itemsProgress', { processed: task.processed_files, total: task.total_files })
                    ) : (
                      // 其他任务显示字节数
                      <>
                        {formatSize(task.processed_size)} / {formatSize(task.total_size)}
                        {task.total_files > 1 && ` (${task.processed_files}/${task.total_files})`}
                      </>
                    )}
                  </span>
                  {task.task_type !== 'extract' && (
                    <span className="task-sidebar__item-speed">
                      {task.status === 'running' ? formatSpeed(task.speed) : '--'}
                    </span>
                  )}
                  {task.task_type === 'upload' && task.status === 'running' && (
                    <span className="task-sidebar__item-status">
                      {uploadActivityLabel(task)}
                    </span>
                  )}
                  <span className="task-sidebar__item-eta">
                    ETA: {formatEta(task.eta_seconds)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* 已中断的任务 */}
        {interruptedTasks.length > 0 && (
          <div className="task-sidebar__section">
            <div className="task-sidebar__section-title">
              {t('taskSidebar.interrupted')} ({interruptedTasks.length})
            </div>
            {interruptedTasks.map(task => (
              <div key={task.id} className={`task-sidebar__item task-sidebar__item--interrupted`}>
                <div className="task-sidebar__item-header">
                  <div className="task-sidebar__item-icon">
                    {getTaskIcon(task.task_type)}
                  </div>
                  <div className="task-sidebar__item-info-wrapper">
                    <div className="task-sidebar__item-name" title={task.name}>
                      {task.name}
                    </div>
                    <div className="task-sidebar__item-path" title={getTargetPath(task)}>
                      → {getTargetPath(task).length > 25 ? '...' + getTargetPath(task).slice(-25) : getTargetPath(task)}
                    </div>
                  </div>
                  {getStatusIcon(task.status)}
                </div>
                <div className="task-sidebar__item-progress">
                  <div 
                    className="task-sidebar__item-progress-bar task-sidebar__item-progress-bar--interrupted"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <div className="task-sidebar__item-info">
                  <span className="task-sidebar__item-size">
                    {formatSize(task.processed_size)} / {formatSize(task.total_size)}
                    {task.total_files > 1 && ` (${task.processed_files}/${task.total_files})`}
                  </span>
                  <span className="task-sidebar__item-status">
                    {task.task_type === 'upload' ? uploadActivityLabel(task) : getStatusText(task.status)}
                  </span>
                </div>
                <div className="task-sidebar__item-actions">
                  {task.task_type === 'upload' ? (
                    <button 
                      className="task-sidebar__item-btn task-sidebar__item-btn--resume"
                      onClick={() => handleRetryTask(task.id)}
                      title={t('taskSidebar.continueUpload')}
                    >
                      {t('taskSidebar.continueUpload')}
                    </button>
                  ) : (
                    <button 
                      className="task-sidebar__item-btn task-sidebar__item-btn--resume"
                      onClick={() => handleRestartTask(task.id)}
                      title={t('taskSidebar.retry')}
                    >
                      {t('taskSidebar.retry')}
                    </button>
                  )}
                  <button 
                    className="task-sidebar__item-btn task-sidebar__item-btn--remove"
                    onClick={() => handleRemoveTask(task.id)}
                    title={t('taskSidebar.remove')}
                  >
                    {t('taskSidebar.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* 已完成的任务 */}
        {completedTasks.length > 0 && (
          <div className="task-sidebar__section">
            <div className="task-sidebar__section-header">
              <span className="task-sidebar__section-title">
                {t('fileBrowser.completedTasks')} ({completedTasks.length})
              </span>
              <button 
                className="task-sidebar__clear-btn"
                onClick={handleClearCompleted}
              >
                {t('fileBrowser.clearCompleted')}
              </button>
            </div>
            {completedTasks.map(task => (
              <div key={task.id} className={`task-sidebar__item task-sidebar__item--${task.status}`}>
                <div className="task-sidebar__item-header">
                  <div className="task-sidebar__item-icon">
                    {getTaskIcon(task.task_type)}
                  </div>
                  <div className="task-sidebar__item-info-wrapper">
                    <div className="task-sidebar__item-name" title={task.name}>
                      {task.name}
                    </div>
                    <div className="task-sidebar__item-path" title={getTargetPath(task)}>
                      → {getTargetPath(task).length > 25 ? '...' + getTargetPath(task).slice(-25) : getTargetPath(task)}
                    </div>
                  </div>
                  {getStatusIcon(task.status)}
                </div>
                <div className="task-sidebar__item-detail">
                  <span className="task-sidebar__item-size">
                    {task.task_type === 'extract' ? t('taskSidebar.items', { count: task.total_files }) : formatSize(task.total_size)}
                  </span>
                  <span 
                    className="task-sidebar__item-time task-sidebar__item-time--clickable"
                    onClick={() => toggleTimeDisplay(task.id)}
                    title={showExactTime[task.id] ? t('taskSidebar.clickForRelative') : t('taskSidebar.clickForExact')}
                  >
                    {showExactTime[task.id] ? formatFinishedTimeExact(task.finished_at) : formatFinishedTimeRelative(task.finished_at)}
                  </span>
                </div>
                {task.error && (
                  <div className="task-sidebar__item-error" title={task.error}>
                    {task.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* 空状态 */}
        {tasks.length === 0 && (
          <div className="task-sidebar__empty">
            {t('fileBrowser.noTasks')}
          </div>
        )}
      </div>
    </div>
  )
}
