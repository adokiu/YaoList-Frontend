import { useEffect, useRef, useCallback } from 'react'

/** OpenList 对齐的任务视图（SSE snapshot / task 事件） */
export interface OpenListTaskView {
  id: string
  task_type: string
  lifecycle?: string
  state: string
  status: string
  name: string
  source_path: string
  target_path?: string
  total_size: number
  processed_size: number
  total_files: number
  processed_files: number
  progress: number
  speed: number
  eta_seconds?: number
  created_at: string
  started_at?: string
  finished_at?: string
  error?: string
  current_file?: string
  upload_phase?: string
}

function lifecycleFromOpenList(task: OpenListTaskView): string {
  const raw = task.lifecycle != null ? String(task.lifecycle).toLowerCase() : ''
  const fromLifecycle: Record<string, string> = {
    pending: 'pending',
    running: 'running',
    paused: 'paused',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    interrupted: 'interrupted',
  }
  if (raw && fromLifecycle[raw]) return fromLifecycle[raw]

  switch (task.state) {
    case 'pending':
      return 'pending'
    case 'running':
      return 'running'
    case 'succeeded':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'canceled':
      return 'cancelled'
    default:
      return 'running'
  }
}

export function toSidebarTask(t: OpenListTaskView) {
  return {
    id: t.id,
    task_type: t.task_type as 'upload' | 'download' | 'copy' | 'move' | 'delete' | 'extract',
    status: lifecycleFromOpenList(t) as
      | 'pending'
      | 'running'
      | 'paused'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'interrupted',
    name: t.name,
    source_path: t.source_path,
    target_path: t.target_path,
    total_size: t.total_size,
    processed_size: t.processed_size,
    total_files: t.total_files,
    processed_files: t.processed_files,
    progress: t.progress,
    speed: t.speed,
    eta_seconds: t.eta_seconds,
    created_at: t.created_at,
    started_at: t.started_at,
    finished_at: t.finished_at,
    error: t.error,
    current_file: t.current_file,
    openlist_state: t.state,
    openlist_status: t.status,
    upload_phase: t.upload_phase,
  }
}

export type SidebarTask = ReturnType<typeof toSidebarTask>

function applyTaskEvent(list: SidebarTask[], payload: { type: string; task: OpenListTaskView }): SidebarTask[] {
  const next = toSidebarTask(payload.task)
  const idx = list.findIndex((x) => x.id === next.id)
  if (payload.type === 'task_cancelled' && idx >= 0) {
    const copy = [...list]
    copy[idx] = { ...copy[idx], ...next, status: 'cancelled' }
    return copy
  }
  if (idx >= 0) {
    const copy = [...list]
    copy[idx] = { ...copy[idx], ...next }
    return copy
  }
  return [next, ...list]
}

export type UseTaskEventsSseOptions = {
  /** 侧边栏：snapshot 替换列表；管理后台表格：忽略 snapshot（分页由 list API 负责） */
  snapshotMode?: 'replace' | 'ignore'
  /** 单条任务变更（管理后台增量更新当前页） */
  onTaskPatch?: (task: SidebarTask, eventType: string) => void
}

export function useTaskEventsSse(
  enabled: boolean,
  onTasks: (tasks: SidebarTask[]) => void,
  options?: UseTaskEventsSseOptions,
) {
  const esRef = useRef<EventSource | null>(null)
  const tasksRef = useRef<SidebarTask[]>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  const setTasks = useCallback(
    (updater: SidebarTask[] | ((prev: SidebarTask[]) => SidebarTask[])) => {
      tasksRef.current =
        typeof updater === 'function' ? updater(tasksRef.current) : updater
      onTasks(tasksRef.current)
    },
    [onTasks],
  )

  useEffect(() => {
    if (!enabled) {
      esRef.current?.close()
      esRef.current = null
      return
    }

    const es = new EventSource('/api/tasks/events', { withCredentials: true })
    esRef.current = es

    es.addEventListener('snapshot', (ev) => {
      try {
        const body = JSON.parse((ev as MessageEvent).data)
        if (optionsRef.current?.snapshotMode === 'ignore') {
          return
        }
        const data = (body.data || []) as OpenListTaskView[]
        setTasks(data.map(toSidebarTask))
      } catch (e) {
        console.error('SSE snapshot parse error', e)
      }
    })

    es.addEventListener('task', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          type: string
          task: OpenListTaskView
        }
        const patch = toSidebarTask(payload.task)
        if (optionsRef.current?.onTaskPatch) {
          optionsRef.current.onTaskPatch(patch, payload.type)
          return
        }
        setTasks((prev) => applyTaskEvent(prev, payload))
      } catch (e) {
        console.error('SSE task parse error', e)
      }
    })

    es.onerror = () => {
      // EventSource 会自动重连
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [enabled, setTasks])
}
