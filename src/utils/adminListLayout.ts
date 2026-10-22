import type { Column } from '../components/DataTable/DataTable'
import { columnWeightFromListSettings, parseCssLengthToPx } from './listColumnTrack'

export type AdminListLayoutId = 'groups' | 'users' | 'shares' | 'links' | 'metadata' | 'tasks'

export const ENTITY_LIST_PAGE_MAX_WIDTH = '1600px'
export const ENTITY_LIST_COLUMN_GAP = '12px'

export function entityListGrowColumnKeys(listId: AdminListLayoutId): Set<string> {
  switch (listId) {
    case 'users':
      return new Set(['email', 'username'])
    case 'groups':
      return new Set(['description'])
    case 'shares':
      return new Set(['path', 'name'])
    case 'links':
      return new Set(['path'])
    case 'metadata':
      return new Set(['path'])
    case 'tasks':
      return new Set(['name', 'source_path', 'target_path'])
  }
}

export const ENTITY_LIST_LOCKED_COLUMN_PX: Record<string, number> = {
  id: 80,
  status: 88,
  enabled: 108,
}

export function isEntityListLockedColumn(key: string): boolean {
  return key in ENTITY_LIST_LOCKED_COLUMN_PX
}

export const ENTITY_LIST_ACTIONS_COLUMN_PX = 192

export function isEntityListActionsColumn(key: string): boolean {
  return key === 'actions' || key === 'action'
}

const COLUMN_WIDTHS_GROUPS: Record<string, string> = {
  id: '72px',
  name: 'minmax(120px, 0.8fr)',
  description: 'minmax(160px, 1fr)',
  user_count: '88px',
  permissions: '200px',
  created_at: '168px',
  actions: '168px',
}

const COLUMN_WIDTHS_USERS: Record<string, string> = {
  id: '80px',
  username: 'minmax(112px, 0.55fr)',
  email: 'minmax(160px, 1fr)',
  phone: '108px',
  groups: '132px',
  total_traffic: '112px',
  total_requests: '88px',
  enabled: '108px',
  created_at: '160px',
  last_login: '160px',
  actions: '192px',
}

const COLUMN_WIDTHS_SHARES: Record<string, string> = {
  creator: '100px',
  name: 'minmax(140px, 0.6fr)',
  path: 'minmax(160px, 1fr)',
  password: '88px',
  created_at: '168px',
  expires_at: '168px',
  access_count: '88px',
  status: '88px',
  actions: '168px',
}

const COLUMN_WIDTHS_LINKS: Record<string, string> = {
  creator: '100px',
  filename: 'minmax(140px, 0.5fr)',
  path: 'minmax(180px, 1fr)',
  created_at: '168px',
  expires_at: '168px',
  access_count: '88px',
  status: '88px',
  actions: '168px',
}

const COLUMN_WIDTHS_METADATA: Record<string, string> = {
  path: 'minmax(180px, 1fr)',
  password: '88px',
  write: '88px',
  hide: '88px',
  header: 'minmax(140px, 0.6fr)',
  readme: 'minmax(140px, 0.6fr)',
  actions: '168px',
}

const COLUMN_WIDTHS_TASKS: Record<string, string> = {
  type: '100px',
  status: '100px',
  name: 'minmax(140px, 0.5fr)',
  source_path: 'minmax(160px, 0.8fr)',
  target_path: 'minmax(160px, 0.8fr)',
  progress: '140px',
  creator: '100px',
  created_at: '168px',
  actions: '140px',
}

function columnWidthsForList(listId: AdminListLayoutId): Record<string, string> {
  switch (listId) {
    case 'groups':
      return COLUMN_WIDTHS_GROUPS
    case 'users':
      return COLUMN_WIDTHS_USERS
    case 'shares':
      return COLUMN_WIDTHS_SHARES
    case 'links':
      return COLUMN_WIDTHS_LINKS
    case 'metadata':
      return COLUMN_WIDTHS_METADATA
    case 'tasks':
      return COLUMN_WIDTHS_TASKS
  }
}

const GROW_MIN_PX: Record<string, number> = {
  description: 140,
  email: 160,
  username: 120,
  path: 140,
  name: 120,
  url: 160,
  value: 160,
  message: 140,
  file_path: 160,
  name: 120,
  source_path: 140,
  target_path: 140,
  header: 120,
  readme: 120,
  groups: 100,
}

export function entityListGrowMinPx(listId: AdminListLayoutId, columnKey: string): number {
  return GROW_MIN_PX[columnKey] ?? 100
}

export function entityListPageMaxWidthPx(): number {
  return parseCssLengthToPx(ENTITY_LIST_PAGE_MAX_WIDTH) || 1600
}

export function entityListMinTableWidth(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  listId: AdminListLayoutId,
  extraReservedPx = 0,
): number {
  const columnWidths = columnWidthsForList(listId)
  const growKeys = entityListGrowColumnKeys(listId)
  let sum = 0
  for (const col of columns) {
    const locked = ENTITY_LIST_LOCKED_COLUMN_PX[col.key]
    if (locked != null) {
      sum += locked
      continue
    }
    if (isEntityListActionsColumn(col.key)) {
      sum += ENTITY_LIST_ACTIONS_COLUMN_PX
      continue
    }
    if (growKeys.has(col.key)) {
      sum += entityListGrowMinPx(listId, col.key)
      continue
    }
    sum += columnWeightFromListSettings(
      col.key,
      columnWidths,
      typeof col.width === 'number' ? col.width : 72,
    )
  }
  return sum + 32 + extraReservedPx
}

export function distributeEntityListColumns(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  listId: AdminListLayoutId,
  tableWidthPx?: number,
  extraReservedPx = 0,
): Record<string, number> {
  const columnWidths = columnWidthsForList(listId)
  const pageMax = entityListPageMaxWidthPx()
  const measured = tableWidthPx != null && tableWidthPx > 0 ? tableWidthPx : pageMax
  const naturalMin = entityListMinTableWidth(columns, listId)
  const contentWidth = Math.max(naturalMin, Math.min(measured, pageMax))

  const lockedSum = columns.reduce((sum, col) => {
    const px = ENTITY_LIST_LOCKED_COLUMN_PX[col.key]
    return px != null ? sum + px : sum
  }, 0)

  const growKeys = entityListGrowColumnKeys(listId)
  const growReserve = columns.reduce(
    (sum, col) => (growKeys.has(col.key) ? sum + entityListGrowMinPx(listId, col.key) : sum),
    0,
  )

  const flexColumns = columns.filter(
    (col) =>
      !growKeys.has(col.key) &&
      !isEntityListLockedColumn(col.key) &&
      !isEntityListActionsColumn(col.key) &&
      !(col.fixedWidth && typeof col.width === 'number'),
  )
  const actionsCol = columns.find((col) => isEntityListActionsColumn(col.key))
  const actionsReserve = actionsCol ? ENTITY_LIST_ACTIONS_COLUMN_PX : 0
  const fixedWidthSum = columns.reduce((sum, col) => {
    if (growKeys.has(col.key) || isEntityListActionsColumn(col.key)) return sum
    if (isEntityListLockedColumn(col.key)) return sum
    if (col.fixedWidth && typeof col.width === 'number') return sum + col.width
    return sum
  }, 0)
  const flexBudget = Math.max(
    160,
    contentWidth -
      lockedSum -
      growReserve -
      actionsReserve -
      extraReservedPx -
      fixedWidthSum,
  )

  const weights = flexColumns.map((col) =>
    columnWeightFromListSettings(
      col.key,
      columnWidths,
      typeof col.width === 'number' ? col.width : 72,
    ),
  )
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1
  const allocatedFlex = weights.map((w) => Math.floor((w / weightSum) * flexBudget))
  let usedFlex = allocatedFlex.reduce((sum, w) => sum + w, 0)
  const remainder = flexBudget - usedFlex
  if (remainder !== 0 && allocatedFlex.length > 0) {
    allocatedFlex[allocatedFlex.length - 1] =
      (allocatedFlex[allocatedFlex.length - 1] ?? 0) + remainder
  }

  const map: Record<string, number> = {}
  let flexIndex = 0
  for (const col of columns) {
    if (growKeys.has(col.key)) continue
    if (isEntityListActionsColumn(col.key)) continue
    if (col.fixedWidth && typeof col.width === 'number') {
      map[col.key] = col.width
      continue
    }
    const locked = ENTITY_LIST_LOCKED_COLUMN_PX[col.key]
    if (locked != null) {
      map[col.key] = locked
      continue
    }
    map[col.key] = allocatedFlex[flexIndex] ?? 72
    flexIndex += 1
  }

  if (actionsCol) {
    map[actionsCol.key] = ENTITY_LIST_ACTIONS_COLUMN_PX
  }

  const growCols = columns.filter((col) => growKeys.has(col.key))
  if (growCols.length > 0) {
    const used =
      Object.values(map).reduce((sum, w) => sum + w, 0) + extraReservedPx
    let remaining = contentWidth - used
    if (remaining < growReserve) {
      remaining = growReserve
    }
    const share = Math.max(
      ...growCols.map((col) => entityListGrowMinPx(listId, col.key)),
      Math.floor(remaining / growCols.length),
    )
    for (const col of growCols) {
      map[col.key] = Math.max(entityListGrowMinPx(listId, col.key), share)
    }
  }

  return map
}
