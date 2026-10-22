import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { joinFsPath, streamUpload } from '../../../utils/openlistUpload'
import { Copy, Check, Edit3, Save, X } from 'lucide-react'
import FilePreviewDropdown from '../../../components/FilePreviewDropdown'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-less'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-batch'
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-toml'
import './previews.scss'

// 支持的编码列表
const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK' },
  { value: 'gb2312', label: 'GB2312' },
  { value: 'gb18030', label: 'GB18030' },
  { value: 'big5', label: 'Big5' },
  { value: 'shift_jis', label: 'Shift-JIS' },
  { value: 'euc-kr', label: 'EUC-KR' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
  { value: 'windows-1252', label: 'Windows-1252' },
]

interface FileInfo {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: string
}

interface TextPreviewProps {
  url: string
  file: FileInfo
  onClose?: () => void
  canEdit?: boolean // 是否有编辑权限（需要上传+删除权限）
}

// 根据文件扩展名获取 Prism 语言标识
function getLanguage(filename: string | undefined): string {
  if (!filename) return 'plaintext'
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    pyw: 'python',
    rb: 'ruby',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    hxx: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    xml: 'markup',
    svg: 'markup',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    psm1: 'powershell',
    bat: 'bash',
    cmd: 'bash',
    lua: 'lua',
    r: 'r',
    pl: 'perl',
    pm: 'perl',
    dockerfile: 'docker',
    conf: 'nginx',
    ini: 'ini',
    cfg: 'ini',
    toml: 'toml',
    env: 'bash',
    gitignore: 'bash',
    log: 'plaintext',
    txt: 'plaintext',
  }
  
  // 特殊文件名匹配
  const lowerName = filename.toLowerCase()
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) return 'docker'
  if (lowerName === 'makefile' || lowerName === 'gnumakefile') return 'makefile'
  if (lowerName === '.gitignore' || lowerName === '.dockerignore') return 'bash'
  if (lowerName === '.env' || lowerName.startsWith('.env.')) return 'bash'
  
  return langMap[ext] || 'plaintext'
}

// 获取语言显示名称
function getLanguageDisplayName(lang: string): string {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    jsx: 'JSX',
    tsx: 'TSX',
    python: 'Python',
    ruby: 'Ruby',
    java: 'Java',
    c: 'C',
    clike: 'C',
    cpp: 'C++',
    csharp: 'C#',
    go: 'Go',
    rust: 'Rust',
    swift: 'Swift',
    kotlin: 'Kotlin',
    php: 'PHP',
    html: 'HTML',
    markup: 'XML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    sql: 'SQL',
    bash: 'Shell',
    powershell: 'PowerShell',
    lua: 'Lua',
    r: 'R',
    perl: 'Perl',
    docker: 'Dockerfile',
    ini: 'INI',
    toml: 'TOML',
    plaintext: 'Plain Text',
  }
  return displayNames[lang] || lang.toUpperCase()
}

export default function TextPreview({ url, file, canEdit = false }: TextPreviewProps) {
  const { t } = useTranslation()
  const filename = file?.name || ''
  const filePath = file?.path || ''
  const [content, setContent] = useState<string>('')
  const [editContent, setEditContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [encoding, setEncoding] = useState('utf-8')
  const [showEncodingMenu, setShowEncodingMenu] = useState(false)
  const [rawData, setRawData] = useState<ArrayBuffer | null>(null)
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const codeRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const language = getLanguage(filename)
  const displayName = getLanguageDisplayName(language)
  
  // 查找状态栏插槽
  useLayoutEffect(() => {
    const slot = document.getElementById('text-preview-status-slot')
    setStatusSlot(slot)
  }, [])
  
  // 在 content 变化后调用 Prism 高亮
  useEffect(() => {
    if (codeRef.current && content) {
      codeRef.current.textContent = content
      if (language !== 'plaintext') {
        Prism.highlightElement(codeRef.current)
      }
    }
  }, [content, language])

  // 获取文件原始数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const buffer = await response.arrayBuffer()
        setRawData(buffer)
      } catch (err: any) {
        setError(err.message || t('preview.loadFailed'))
        setLoading(false)
      }
    }
    fetchData()
  }, [url])

  // 使用指定编码解码内容
  useEffect(() => {
    if (!rawData) return
    
    try {
      const decoder = new TextDecoder(encoding)
      const text = decoder.decode(rawData)
      setContent(text)
    } catch (err: any) {
      setError(t('preview.encodingError') + ': ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [rawData, encoding])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
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

  // 进入编辑模式
  const handleStartEdit = () => {
    setEditContent(content)
    setIsEditing(true)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  // 保存文件
  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    
    try {
      // 获取目录路径
      const pathParts = filePath.split('/')
      pathParts.pop() // 移除文件名
      const targetPath = pathParts.join('/') || '/'
      
      // 创建 Blob 并上传
      const blob = new Blob([editContent], { type: 'text/plain;charset=utf-8' })
      const fileToUpload = new File([blob], filename, { type: 'text/plain' })
      
      const fullPath = joinFsPath(targetPath || '/', filename)
      await streamUpload(fileToUpload, fullPath, { overwrite: true })
      setContent(editContent)
      setIsEditing(false)
      const res = await fetch(url)
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        setRawData(buffer)
      }
    } catch (err: any) {
      alert(err.message || t('preview.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const lines = content.split('\n')
  
  // 状态栏内容
  const statusContent = (
    <>
      <span className="preview__text-status-item">{displayName}</span>
      <span className="preview__text-status-item">
        {t('preview.lineCount', { count: lines.length })}
      </span>
      <FilePreviewDropdown
        label={ENCODINGS.find(e => e.value === encoding)?.label || encoding}
        open={showEncodingMenu}
        onOpenChange={setShowEncodingMenu}
        align="end"
      >
        {ENCODINGS.map(enc => (
          <button
            type="button"
            key={enc.value}
            className={`file-preview__dropdown-item ${encoding === enc.value ? 'active' : ''}`}
            onClick={() => {
              setEncoding(enc.value)
              setShowEncodingMenu(false)
            }}
          >
            {enc.label}
          </button>
        ))}
      </FilePreviewDropdown>
    </>
  )

  return (
    <div className="preview preview--text">
      {/* 状态栏 - 通过 Portal 渲染到顶部工具栏 */}
      {statusSlot && createPortal(statusContent, statusSlot)}

      {/* 内容区域 */}
      <div className="preview__text-content">
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
        
        {!loading && !error && !isEditing && (
          <div className="preview__text-code">
            {/* 操作按钮 */}
            <div className="preview__text-actions">
              {canEdit && (
                <button 
                  className="preview__text-action-btn"
                  onClick={handleStartEdit}
                  title={t('preview.edit')}
                >
                  <Edit3 size={16} />
                </button>
              )}
              <button 
                className="preview__text-action-btn"
                onClick={handleCopy}
                title={t('preview.copyCode')}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="preview__text-code-scroll">
              <div className="preview__text-line-numbers" aria-hidden="true">
                {lines.map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              <pre className="preview__text-pre">
                <code ref={codeRef} className={`language-${language}`} />
              </pre>
            </div>
          </div>
        )}
        
        {/* 编辑模式 */}
        {!loading && !error && isEditing && (
          <div className="preview__text-editor">
            <div className="preview__text-editor-toolbar">
              <span className="preview__text-editor-hint">{t('preview.editing')}</span>
              <div className="preview__text-editor-actions">
                <button 
                  className="preview__text-editor-btn preview__text-editor-btn--cancel"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <X size={16} />
                  <span>{t('common.cancel')}</span>
                </button>
                <button 
                  className="preview__text-editor-btn preview__text-editor-btn--save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save size={16} />
                  <span>{saving ? t('preview.saving') : t('common.save')}</span>
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="preview__text-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
