import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react'
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { formatCellDisplay } from '../../utils/formatCellDisplay'
import {
  type AdminListLayoutId,
  ENTITY_LIST_COLUMN_GAP,
  entityListGrowColumnKeys,
  ENTITY_LIST_PAGE_MAX_WIDTH,
  distributeEntityListColumns,
  entityListGrowMinPx,
  entityListMinTableWidth,
  entityListPageMaxWidthPx,
  isEntityListActionsColumn,
  isEntityListLockedColumn,
} from '../../utils/adminListLayout'
import { Pagination } from './Pagination'
import './DataTable.css'

export interface RowContext {
  level: number
  expanded: boolean
  canExpand: boolean
  onToggleExpand?: (key: string | number) => void
}

export interface Column<T> {
  key: string
  title: string
  width?: number | string
  /** 与 width 相同，且 min/max 锁死，列宽不随内容伸缩 */
  fixedWidth?: boolean
  sortable?: boolean
  render?: (row: T, index: number, ctx?: RowContext) => ReactNode
}

function columnWidthCss(width: number | string): string {
  return typeof width === 'number' ? `${width}px` : width
}

function cellClassName(col: Pick<Column<unknown>, 'key' | 'fixedWidth'>, entityList: boolean): string {
  return [
    col.fixedWidth ? 'data-table__col--fixed-width' : '',
    entityList && isEntityListActionsColumn(col.key) ? 'data-table__td--actions' : '',
    !entityList && col.key === 'action' ? 'data-table__td--sticky-right' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function headerClassName(col: Pick<Column<unknown>, 'key' | 'fixedWidth' | 'sortable'>, entityList: boolean): string {
  return [
    col.fixedWidth ? 'data-table__col--fixed-width' : '',
    entityList && isEntityListActionsColumn(col.key) ? 'data-table__th--actions' : '',
    !entityList && col.key === 'action' ? 'data-table__th--sticky-right' : '',
    col.sortable ? 'data-table__th--sortable' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export type EntityListLayoutOptions = {
  entityList: true
  listLayoutId: AdminListLayoutId
  columnWidthPxByKey: Record<string, number>
}

export function columnLayoutStyle(
  col: Pick<Column<unknown>, 'key' | 'width' | 'fixedWidth'>,
  options?: EntityListLayoutOptions,
): CSSProperties | undefined {
  if (options?.entityList) {
    const px = options.columnWidthPxByKey[col.key]
    if (entityListGrowColumnKeys(options.listLayoutId).has(col.key)) {
      if (px == null) return undefined
      const min = entityListGrowMinPx(options.listLayoutId, col.key)
      return { width: `${px}px`, minWidth: `${min}px` }
    }
    if (px == null) return undefined
    const w = `${px}px`
    return { width: w, minWidth: w, maxWidth: w }
  }
  if (col.width == null) return undefined
  const w = columnWidthCss(col.width)
  if (col.fixedWidth) {
    return { width: w, minWidth: w, maxWidth: w }
  }
  return { width: w }
}

export interface SortState {
  field: string
  order: 'asc' | 'desc'
}

export interface PaginationState {
  page: number
  size: number
  total: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  pagination?: PaginationState
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
  emptyText?: string
  selectable?: boolean
  selectedKeys?: Set<string | number>
  onSelectionChange?: (keys: Set<string | number>) => void
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  header?: ReactNode
  footer?: ReactNode
  expandedRowKeys?: (string | number)[]
  renderExpanded?: (row: T) => ReactNode
  getChildren?: (row: T) => T[]
  hasChildren?: (row: T) => boolean
  expandedKeys?: Set<string | number>
  onToggleExpand?: (key: string | number) => void
  getLevel?: (row: T) => number
  /** 例如 `data-table--entity-list`，用于节点/Client 等固定前列宽 */
  tableClassName?: string
  /** 与 `tableClassName="data-table--entity-list"` 同用，nodes / clients 各一套硬编码列宽 */
  listLayoutId?: AdminListLayoutId
}

interface TableRowProps<T> {
  row: T
  index: number
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  selectable: boolean
  selectedKeys?: Set<string | number>
  onToggleRow?: (key: string | number) => void
  expandedKeys?: Set<string | number>
  renderExpanded?: (row: T) => ReactNode
  getChildren?: (row: T) => T[]
  hasChildren?: (row: T) => boolean
  onToggleExpand?: (key: string | number) => void
  getLevel?: (row: T) => number
  level: number
  columnLayoutOptions?: EntityListLayoutOptions
}

function TableRowImpl<T>({
  row,
  index,
  columns,
  rowKey,
  selectable,
  selectedKeys,
  onToggleRow,
  expandedKeys,
  renderExpanded,
  getChildren,
  hasChildren,
  onToggleExpand,
  getLevel,
  level,
  columnLayoutOptions,
}: TableRowProps<T>) {
  const key = rowKey(row)
  const checked = selectedKeys?.has(key) ?? false
  const isExpanded = expandedKeys?.has(key) ?? false
  const canExpand = hasChildren ? hasChildren(row) : false
  const colSpan = columns.length + (selectable ? 1 : 0)

  const rows: ReactNode[] = [
    <tr key={key} className={checked ? 'data-table__row--selected' : ''}>
      {selectable && (
        <td>
          <input
            type="checkbox"
            className="data-table__checkbox"
            checked={checked}
            onChange={() => onToggleRow?.(key)}
          />
        </td>
      )}
      {columns.map((col) => (
        <td
          key={col.key}
          style={columnLayoutStyle(col, columnLayoutOptions)}
          className={cellClassName(col, Boolean(columnLayoutOptions?.entityList)) || undefined}
        >
          {col.render
            ? col.render(row, index, { level, expanded: isExpanded, canExpand, onToggleExpand })
            : formatCellDisplay(col.key, (row as Record<string, unknown>)[col.key])}
        </td>
      ))}
    </tr>,
  ]
  if (isExpanded && renderExpanded) {
    rows.push(
      <tr key={`${key}-expanded`} className="data-table__row--expanded">
        <td colSpan={colSpan} style={{ padding: 0, border: 'none' }}>
          {renderExpanded(row)}
        </td>
      </tr>,
    )
  }
  if (isExpanded && getChildren && canExpand) {
    const children = getChildren(row)
    children.forEach((child, childIdx) => {
      rows.push(
        <TableRow
          key={rowKey(child)}
          row={child}
          index={childIdx}
          columns={columns}
          rowKey={rowKey}
          selectable={selectable}
          selectedKeys={selectedKeys}
          onToggleRow={onToggleRow}
          expandedKeys={expandedKeys}
          renderExpanded={renderExpanded}
          getChildren={getChildren}
          hasChildren={hasChildren}
          onToggleExpand={onToggleExpand}
          getLevel={getLevel}
          level={level + 1}
          columnLayoutOptions={columnLayoutOptions}
        />
      )
    })
  }
  return <>{rows}</>
}

const TableRow = memo(TableRowImpl, (prev, next) => {
  return prev.row === next.row &&
    prev.index === next.index &&
    prev.columns === next.columns &&
    prev.selectable === next.selectable &&
    prev.selectedKeys === next.selectedKeys &&
    prev.expandedKeys === next.expandedKeys &&
    prev.level === next.level &&
    prev.columnLayoutOptions === next.columnLayoutOptions
}) as <T>(props: TableRowProps<T>) => ReactNode

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  pagination,
  onPageChange,
  onSizeChange,
  emptyText = '暂无数据',
  selectable = false,
  selectedKeys,
  onSelectionChange,
  sort,
  onSortChange,
  header,
  footer,
  expandedRowKeys,
  renderExpanded,
  getChildren,
  hasChildren,
  expandedKeys,
  onToggleExpand,
  getLevel,
  tableClassName,
  listLayoutId,
}: DataTableProps<T>) {
  const safeData = Array.isArray(data) ? data : []
  const allKeys = useMemo(() => safeData.map((r) => rowKey(r)), [safeData, rowKey])
  const allSelected = useMemo(
    () => allKeys.length > 0 && selectedKeys != null && allKeys.every((k) => selectedKeys.has(k)),
    [allKeys, selectedKeys],
  )

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return
    if (allSelected) {
      const next = new Set(selectedKeys)
      allKeys.forEach((k) => next.delete(k))
      onSelectionChange(next)
    } else {
      const next = new Set(selectedKeys)
      allKeys.forEach((k) => next.add(k))
      onSelectionChange(next)
    }
  }, [allSelected, allKeys, selectedKeys, onSelectionChange])

  const toggleRow = useCallback(
    (key: string | number) => {
      if (!onSelectionChange || !selectedKeys) return
      const next = new Set(selectedKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      onSelectionChange(next)
    },
    [selectedKeys, onSelectionChange],
  )

  const colSpan = columns.length + (selectable ? 1 : 0)
  const selectionReservePx = selectable ? 40 : 0

  const isEntityList = tableClassName === 'data-table--entity-list'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollClientWidth, setScrollClientWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!isEntityList) return
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setScrollClientWidth(w)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isEntityList])

  const tableMinWidthPx = useMemo(() => {
    if (!isEntityList || !listLayoutId) return 0
    return entityListMinTableWidth(columns, listLayoutId, selectionReservePx)
  }, [columns, isEntityList, listLayoutId, selectionReservePx])

  const colLayoutOpts = useMemo((): EntityListLayoutOptions | undefined => {
    if (!isEntityList || !listLayoutId) return undefined
    const pageMax = entityListPageMaxWidthPx()
    const tableWidth =
      scrollClientWidth != null && scrollClientWidth > 0
        ? Math.min(scrollClientWidth, pageMax)
        : pageMax
    return {
      entityList: true,
      listLayoutId,
      columnWidthPxByKey: distributeEntityListColumns(
        columns,
        listLayoutId,
        tableWidth,
        selectionReservePx,
      ),
    }
  }, [columns, isEntityList, listLayoutId, scrollClientWidth, selectionReservePx])

  const entityListWrapperStyle = useMemo((): CSSProperties | undefined => {
    if (!isEntityList) return undefined
    return {
      ['--data-table-scroll-min-width' as string]: ENTITY_LIST_PAGE_MAX_WIDTH,
      ['--admin-list-column-gap' as string]: ENTITY_LIST_COLUMN_GAP,
      ['--entity-list-table-min-width' as string]: `${tableMinWidthPx}px`,
    }
  }, [isEntityList, tableMinWidthPx])

  const effectiveExpandedKeys = useMemo(() => {
    if (expandedKeys) return expandedKeys
    if (expandedRowKeys && expandedRowKeys.length > 0) return new Set(expandedRowKeys)
    return null
  }, [expandedKeys, expandedRowKeys])

  return (
    <div
      className={['data-table-wrapper', isEntityList ? 'data-table-wrapper--entity-list' : '']
        .filter(Boolean)
        .join(' ')}
      style={entityListWrapperStyle}
    >
      {header && <div className="data-table-header">{header}</div>}
      <div className="data-table-body">
      <div className="data-table-scroll" ref={isEntityList ? scrollRef : undefined}>
        <table
          className={['data-table', tableClassName, listLayoutId ? `data-table--list-${listLayoutId}` : '']
            .filter(Boolean)
            .join(' ')}
          style={
            isEntityList && tableMinWidthPx > 0
              ? { width: '100%', minWidth: tableMinWidthPx }
              : undefined
          }
        >
          {isEntityList ? (
            <colgroup>
              {selectable ? <col key="__select" style={{ width: 40, minWidth: 40, maxWidth: 40 }} /> : null}
              {columns.map((col) => (
                <col
                  key={col.key}
                  className={[
                    col.fixedWidth ? 'data-table__col--fixed-width' : '',
                    isEntityListLockedColumn(col.key) ? 'data-table__col--locked' : '',
                    listLayoutId && entityListGrowColumnKeys(listLayoutId).has(col.key)
                      ? 'data-table__col--grow'
                      : '',
                    isEntityListActionsColumn(col.key) ? 'data-table__col--actions' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  style={columnLayoutStyle(col, colLayoutOpts)}
                />
              ))}
            </colgroup>
          ) : null}
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="data-table__checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={columnLayoutStyle(col, colLayoutOpts)}
                  className={headerClassName(col, isEntityList)}
                  onClick={col.sortable && onSortChange ? () => {
                    if (sort?.field === col.key) {
                      onSortChange({ field: col.key, order: sort.order === 'asc' ? 'desc' : 'asc' })
                    } else {
                      onSortChange({ field: col.key, order: 'asc' })
                    }
                  } : undefined}
                >
                  <span className="data-table__th-content">
                    {col.title}
                    {col.sortable && (
                      <span className="data-table__sort-icon">
                        {sort?.field === col.key
                          ? sort.order === 'asc'
                            ? <ArrowUp size={14} />
                            : <ArrowDown size={14} />
                          : <ArrowUpDown size={14} />}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="data-table__loading">
                    <Loader2 size={20} className="data-table__spinner" />
                    <span>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : safeData.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="data-table__empty">{emptyText}</div>
                </td>
              </tr>
            ) : (
              safeData.map((row, idx) => (
                <TableRow
                  key={rowKey(row)}
                  row={row}
                  index={idx}
                  columns={columns}
                  rowKey={rowKey}
                  selectable={selectable}
                  selectedKeys={selectedKeys}
                  onToggleRow={toggleRow}
                  expandedKeys={effectiveExpandedKeys ?? undefined}
                  renderExpanded={renderExpanded}
                  getChildren={getChildren}
                  hasChildren={hasChildren}
                  onToggleExpand={onToggleExpand}
                  getLevel={getLevel}
                  level={getLevel ? getLevel(row) : 0}
                  columnLayoutOptions={colLayoutOpts}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      </div>
      {footer && <div className="data-table-footer">{footer}</div>}
      {pagination && (
        <Pagination
          page={pagination.page}
          size={pagination.size}
          total={pagination.total}
          onPageChange={onPageChange}
          onSizeChange={onSizeChange}
        />
      )}
    </div>
  )
}
