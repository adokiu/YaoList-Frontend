import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Copy, Check, Eye, Code } from 'lucide-react'
import './previews.scss'

interface MarkdownPreviewProps {
  url: string
  filename: string
  onClose?: () => void
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function safeUrl(raw: string): string {
  const url = raw.trim()
  // 只允许 http(s)/mailto/相对路径/锚点；禁止 javascript:、data: 等可执行协议。
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(https?|mailto):/i.test(url)) {
    return '#'
  }
  return escapeAttr(url)
}

// 简单的 Markdown 解析器
function parseMarkdown(md: string): string {
  let html = md
  
  // 转义 HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // 代码块 ```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block" data-lang="${escapeAttr(lang)}"><code>${code.trim()}</code></pre>`
  })
  
  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
  
  // 标题 # ## ### #### ##### ######
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  
  // 粗体 **text** 或 __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // 斜体 *text* 或 _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  
  // 删除线 ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
  
  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`
  )
  
  // 图片 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
    `<img src="${safeUrl(url)}" alt="${escapeAttr(alt)}" class="md-image" />`
  )
  
  // 无序列表
  html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  
  // 有序列表
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
  
  // 引用 > text
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')
  
  // 水平线 --- 或 ***
  html = html.replace(/^(---|\*\*\*)$/gm, '<hr />')
  
  // 段落
  html = html.replace(/^([^<\n].+)$/gm, (match) => {
    if (match.startsWith('<')) return match
    return `<p>${match}</p>`
  })
  
  // 换行
  html = html.replace(/\n\n+/g, '\n')
  
  return html
}

export default function MarkdownPreview({ url, filename }: MarkdownPreviewProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')

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

  const parsedHtml = parseMarkdown(content)

  return (
    <div className="preview preview--markdown">
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
      <div className="preview__markdown-content">
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
          <div 
            className="preview__markdown-rendered"
            dangerouslySetInnerHTML={{ __html: parsedHtml }}
          />
        )}
        
        {!loading && !error && viewMode === 'source' && (
          <pre className="preview__markdown-source">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
