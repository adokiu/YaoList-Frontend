import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Select from '../Select/Select'

interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
}

const sizeOptions = [
  { label: '10 条/页', value: '10' },
  { label: '20 条/页', value: '20' },
  { label: '50 条/页', value: '50' },
  { label: '100 条/页', value: '100' },
]

export function Pagination({ page, size, total, onPageChange, onSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / size))

  const pages = useMemo(() => {
    const maxVisible = 7
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const half = Math.floor(maxVisible / 2)
    let start = Math.max(1, page - half)
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1)
    }
    const result: (number | string)[] = []
    if (start > 1) {
      result.push(1)
      if (start > 2) result.push('...')
    }
    for (let i = start; i <= end; i++) result.push(i)
    if (end < totalPages) {
      if (end < totalPages - 1) result.push('...')
      result.push(totalPages)
    }
    return result
  }, [page, totalPages])

  const go = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== page) onPageChange?.(p)
  }

  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)

  return (
    <div className="pagination">
      <div className="pagination__info">
        第 {from.toLocaleString()}-{to.toLocaleString()} 条，共 {total.toLocaleString()} 条
      </div>

      <div className="pagination__controls">
        {onSizeChange && (
          <Select
            value={String(size)}
            options={sizeOptions}
            onChange={(v) => onSizeChange(Number(v))}
          />
        )}

        <div className="pagination__pages">
          <button className="pagination__btn" disabled={page <= 1} onClick={() => go(1)} aria-label="首页">
            <ChevronsLeft size={16} />
          </button>
          <button className="pagination__btn" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="上一页">
            <ChevronLeft size={16} />
          </button>

          {pages.map((p, i) =>
            typeof p === 'string' ? (
              <span key={`ellipsis-${i}`} className="pagination__ellipsis">...</span>
            ) : (
              <button
                key={p}
                className={`pagination__btn ${p === page ? 'pagination__btn--active' : ''}`}
                onClick={() => go(p)}
              >
                {p}
              </button>
            ),
          )}

          <button className="pagination__btn" disabled={page >= totalPages} onClick={() => go(page + 1)} aria-label="下一页">
            <ChevronRight size={16} />
          </button>
          <button className="pagination__btn" disabled={page >= totalPages} onClick={() => go(totalPages)} aria-label="末页">
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
