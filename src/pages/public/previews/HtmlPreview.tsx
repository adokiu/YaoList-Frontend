import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Copy, Check, Eye, Code, ExternalLink, Maximize2 } from 'lucide-react'
import './previews.scss'

interface FileInfo {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: string
}

interface HtmlPreviewProps {
  url: string
  file: FileInfo
  onClose?: () => void
}

export default function HtmlPreview({ url, file }: HtmlPreviewProps) {
  const { t } = useTranslation()
  const filename = file?.name || ''
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 获取 HTML 内容
  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const text = await response.text()
        setContent(text)
      } catch (err: any) {
        setError(err.message || t('preview.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    
    fetchContent()
  }, [url])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  }

  const handleOpenInNewTab = () => {
    window.open(url, '_blank')
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={`preview preview--html ${isFullscreen ? 'preview--fullscreen' : ''}`}>
      {/* 工具栏 */}
      <div className="preview__toolbar">
        <div className="preview__toolbar-group">
          <button 
            className={`preview__toolbar-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            title={t('preview.previewMode')}
          >
            <Eye size={18} />
          </button>
          <button 
            className={`preview__toolbar-btn ${viewMode === 'source' ? 'active' : ''}`}
            onClick={() => setViewMode('source')}
            title={t('preview.sourceMode')}
          >
            <Code size={18} />
          </button>
        </div>
        <div className="preview__toolbar-group">
          <button 
            className="preview__toolbar-btn"
            onClick={toggleFullscreen}
            title={t('preview.fullscreen')}
          >
            <Maximize2 size={18} />
          </button>
          <button 
            className="preview__toolbar-btn"
            onClick={handleOpenInNewTab}
            title={t('preview.openInNewTab')}
          >
            <ExternalLink size={18} />
          </button>
          <button 
            className="preview__toolbar-btn"
            onClick={handleCopy}
            title={t('preview.copy')}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <button 
            className="preview__toolbar-btn"
            onClick={handleDownload}
            title={t('preview.download')}
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="preview__html-content">
        {loading && (
          <div className="preview__loading">
            <div className="preview__loading-spinner" />
            <span>{t('preview.loading')}</span>
          </div>
        )}
        
        {error && (
          <div className="preview__error">
            <span>{t('preview.loadFailed')}: {error}</span>
          </div>
        )}
        
        {!loading && !error && viewMode === 'preview' && (
          <iframe
            ref={iframeRef}
            className="preview__html-iframe"
            srcDoc={content}
            sandbox=""
            title={filename}
          />
        )}
        
        {!loading && !error && viewMode === 'source' && (
          <pre className="preview__html-source">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
