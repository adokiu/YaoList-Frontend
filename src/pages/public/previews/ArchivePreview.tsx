import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Folder, File, FileText, FileImage, FileVideo, FileAudio, 
  FileArchive, ChevronRight, Loader2, AlertCircle, Home,
  ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import { api } from '../../../utils/api'
import './previews.scss'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface ArchivePreviewProps {
  url: string
  file: {
    name: string
    path: string
    size: number
  }
}

function getPathPassword(targetPath: string): string {
  try {
    const passwords = JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
    if (passwords[targetPath]) return passwords[targetPath]
    const parts = targetPath.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const parent = '/' + parts.slice(0, i).join('/')
      const normalized = parent === '' ? '/' : parent
      if (passwords[normalized]) return passwords[normalized]
    }
    if (passwords['/']) return passwords['/']
  } catch {}
  return ''
}

interface ArchiveEntry {
  name: string
  path: string
  is_dir: boolean
}

// 根据扩展名获取图标
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'heic', 'raw'].includes(ext)) {
    return <FileImage size={16} style={{ color: '#e91e8c' }} />
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
    return <FileVideo size={16} style={{ color: '#9333ea' }} />
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
    return <FileAudio size={16} style={{ color: '#06b6d4' }} />
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive size={16} style={{ color: '#d97706' }} />
  }
  if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
    return <FileText size={16} style={{ color: '#6b7280' }} />
  }
  
  return <File size={16} style={{ color: '#9ca3af' }} />
}

export default function ArchivePreview({ file }: ArchivePreviewProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [format, setFormat] = useState('')
  const [currentPath, setCurrentPath] = useState('')
  const [pathHistory, setPathHistory] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(() => {
    const saved = localStorage.getItem('archivePageSize')
    const parsed = saved ? parseInt(saved, 10) : 50
    return PAGE_SIZE_OPTIONS.includes(parsed as any) ? parsed as typeof PAGE_SIZE_OPTIONS[number] : 50
  })
  const [showPageSizeMenu, setShowPageSizeMenu] = useState(false)
  
  // 分页计算
  const totalPages = Math.ceil(entries.length / pageSize) || 1
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return entries.slice(start, start + pageSize)
  }, [entries, currentPage, pageSize])
  
  const loadDirectory = async (innerPath: string) => {
    setLoading(true)
    setError(null)
    setCurrentPage(1) // 切换目录时重置页码
    
    try {
      const response = await api.post('/api/fs/archive/list', {
        path: file.path,
        inner_path: innerPath,
        password: getPathPassword(file.path) || undefined,
      })
      
      if (response.data.code === 200) {
        const data = response.data.data
        setFormat(data.format)
        setEntries(data.entries)
        setCurrentPath(innerPath)
      } else {
        setError(response.data.message || t('preview.archiveParseFailed'))
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || t('preview.archiveParseFailed'))
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadDirectory('')
  }, [file.path])
  
  const handleItemClick = (entry: ArchiveEntry) => {
    if (entry.is_dir) {
      setPathHistory([...pathHistory, currentPath])
      loadDirectory(entry.path)
    }
  }
  
  const handleGoToRoot = () => {
    setPathHistory([])
    loadDirectory('')
  }
  
  // 面包屑路径
  const breadcrumbs = currentPath ? currentPath.split('/').filter(p => p) : []
  
  if (loading && entries.length === 0) {
    return (
      <div className="archive-preview">
        <div className="archive-preview__loading">
          <Loader2 size={32} className="archive-preview__spinner" />
          <span>{t('preview.parsingArchive')}</span>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="archive-preview">
        <div className="archive-preview__error">
          <AlertCircle size={32} />
          <span>{error}</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="archive-preview">
      <div className="archive-preview__top">
        <div className="archive-preview__title-row">
          <FileArchive size={18} className="archive-preview__title-icon" aria-hidden />
          <span className="archive-preview__title" title={file.name}>
            {file.name}
          </span>
          {format ? <span className="archive-preview__format">{format}</span> : null}
        </div>

        <nav className="archive-preview__breadcrumb" aria-label={t('fileBrowser.path')}>
          <button
            type="button"
            className="archive-preview__breadcrumb-home"
            onClick={handleGoToRoot}
            title={t('fileBrowser.home')}
          >
            <Home size={14} />
          </button>
          {breadcrumbs.map((name, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <span key={index} className="archive-preview__breadcrumb-segment">
                <ChevronRight size={14} className="archive-preview__breadcrumb-sep" aria-hidden />
                {isLast ? (
                  <span className="archive-preview__breadcrumb-current">{name}</span>
                ) : (
                  <button
                    type="button"
                    className="archive-preview__breadcrumb-link"
                    onClick={() => {
                      const targetPath = breadcrumbs.slice(0, index + 1).join('/')
                      setPathHistory([...pathHistory, currentPath])
                      loadDirectory(targetPath)
                    }}
                  >
                    {name}
                  </button>
                )}
              </span>
            )
          })}
        </nav>
      </div>

      <div className="archive-preview__list-head">{t('fileBrowser.name')}</div>

      <div className="archive-preview__list">
        {loading && (
          <div className="archive-preview__loading-overlay">
            <Loader2 size={20} className="archive-preview__spinner" />
          </div>
        )}
        
        {paginatedEntries.map((entry, index) => (
          <div 
            key={entry.path}
            className={`archive-preview__row ${entry.is_dir ? 'archive-preview__row--folder' : ''}`}
            style={{ '--row-index': index } as React.CSSProperties}
            onClick={() => handleItemClick(entry)}
          >
            <div className="archive-preview__col-name">
              <span className="archive-preview__file-icon">
                {entry.is_dir ? (
                  <Folder size={20} style={{ color: '#d4a574' }} />
                ) : (
                  getFileIcon(entry.name)
                )}
              </span>
              <span className="archive-preview__file-name">{entry.name}</span>
            </div>
          </div>
        ))}
        
        {entries.length === 0 && !loading && (
          <div className="archive-preview__empty">
            {t('preview.emptyDirectory')}
          </div>
        )}
      </div>
      
      {/* 分页控件 */}
      {entries.length > 0 && (
        <div className="archive-preview__pagination">
          <div className="archive-preview__page-size">
            <span className="archive-preview__page-size-label">{t('preview.perPage')}</span>
            <div className="archive-preview__page-size-selector">
              <button 
                className="archive-preview__page-size-btn"
                onClick={() => setShowPageSizeMenu(!showPageSizeMenu)}
              >
                {pageSize}
                <ChevronRight size={14} className={`archive-preview__page-size-arrow ${showPageSizeMenu ? 'open' : ''}`} />
              </button>
              {showPageSizeMenu && (
                <div className="archive-preview__page-size-menu">
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <button
                      key={size}
                      className={`archive-preview__page-size-option ${pageSize === size ? 'active' : ''}`}
                      onClick={() => {
                        setPageSize(size)
                        setCurrentPage(1)
                        setShowPageSizeMenu(false)
                        localStorage.setItem('archivePageSize', String(size))
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {totalPages > 1 && (
            <>
              <button 
                className="archive-preview__page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                <ChevronsLeft size={16} />
              </button>
              <button 
                className="archive-preview__page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="archive-preview__page-info">
                {currentPage} / {totalPages}
              </span>
              <button 
                className="archive-preview__page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={16} />
              </button>
              <button 
                className="archive-preview__page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                <ChevronsRight size={16} />
              </button>
            </>
          )}
          
          <span className="archive-preview__page-total">{entries.length} {t('preview.items')}</span>
        </div>
      )}
    </div>
  )
}
