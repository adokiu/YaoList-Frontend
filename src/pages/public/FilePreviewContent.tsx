import { useState, useEffect, useRef, Suspense, useContext, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SharedContext } from './FileRouter'
import { 
  ChevronRight, Home, File,
  Sun, Moon, Languages, Lock, Loader2
} from 'lucide-react'
import { api } from '../../utils/api'
import UserSettingsSidebar from '../../components/UserSettingsSidebar'
import FilePreviewDropdown from '../../components/FilePreviewDropdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import mermaid from 'mermaid'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import '../../styles/pages/file-browser.scss'

// 初始化 Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'default' })

// Mermaid 图表组件
const MermaidChart = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  
  useEffect(() => {
    if (ref.current && chart) {
      const id = 'mermaid-' + Math.random().toString(36).substr(2, 9)
      mermaid.render(id, chart)
        .then(({ svg }) => {
          if (ref.current) {
            ref.current.innerHTML = svg
            setError(false)
          }
        })
        .catch(() => {
          setError(true)
        })
    }
  }, [chart])
  
  if (error) {
    return <pre className="mermaid-fallback"><code>{chart}</code></pre>
  }
  return <div ref={ref} className="mermaid-chart" />
}

// Emoji 映射
const emojiMap: Record<string, string> = {
  'smiley': '😊', 'smile': '😄', 'grin': '😁', 'star': '⭐', 'heart': '❤️',
  'thumbsup': '👍', 'thumbsdown': '👎', 'ok_hand': '👌', 'clap': '👏',
  'fire': '🔥', 'rocket': '🚀', 'warning': '⚠️', 'check': '✅', 'x': '❌',
  'question': '❓', 'exclamation': '❗', 'bulb': '💡', 'memo': '📝',
  'book': '📖', 'link': '🔗', 'lock': '🔒', 'key': '🔑', 'mag': '🔍',
}

const processEmoji = (text: string) => {
  return text.replace(/:([a-z_]+):/g, (match, name) => emojiMap[name] || match)
}

// 检测内容是否是 HTML
const isHtmlContent = (content: string): boolean => {
  const trimmed = content.trim()
  return /^<!DOCTYPE/i.test(trimmed) || 
         /^<html/i.test(trimmed) ||
         /<(html|head|body|script|style|link|meta)\b/i.test(trimmed)
}

// HTML 内容渲染组件
const HtmlContentRenderer = ({ content }: { content: string }) => {
  const [loading, setLoading] = useState(true)
  const [height, setHeight] = useState(50)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  // 构建完整的 HTML 文档以确保外部脚本正确加载
  const resetStyle = `<style>html,body{background:transparent!important;margin:0!important;padding:0!important;overflow:hidden!important;}::-webkit-scrollbar{display:none;}</style>`
  const trimmed = content.trim()
  const hasDoctype = /^<!DOCTYPE/i.test(trimmed)
  const hasHtml = /<html[\s>]/i.test(trimmed)
  
  let contentWithStyle: string
  if (hasDoctype || hasHtml) {
    // 已经是完整 HTML，只注入样式
    contentWithStyle = content.includes('<head>') 
      ? content.replace('<head>', `<head>${resetStyle}`)
      : content.includes('<HEAD>') 
        ? content.replace('<HEAD>', `<HEAD>${resetStyle}`)
        : content.replace(/<html[^>]*>/i, (match) => `${match}<head>${resetStyle}</head>`)
  } else {
    // 包装为完整 HTML 文档
    contentWithStyle = `<!DOCTYPE html><html><head><meta charset="UTF-8">${resetStyle}</head><body>${content}</body></html>`
  }
  
  const handleLoad = () => {
    setLoading(false)
    const updateHeight = () => {
      try {
        const iframe = iframeRef.current
        if (iframe?.contentDocument?.body) {
          const h = iframe.contentDocument.body.scrollHeight
          setHeight(Math.max(h, 30))
        }
      } catch {}
    }
    updateHeight()
    setTimeout(updateHeight, 500)
    setTimeout(updateHeight, 1500)
  }
  
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '16px',
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span>加载中...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={contentWithStyle}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={handleLoad}
        scrolling="no"
        style={{
          width: '100%',
          height: loading ? 0 : height,
          border: 'none',
          background: 'transparent',
          display: loading ? 'none' : 'block',
          overflow: 'hidden'
        }}
      />
    </div>
  )
}

import { getPreviewers, PreviewConfig, audioExtensions, videoExtensions } from './previews'

interface FileItem {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: string
}

interface UserPermissions {
  read_files: boolean
  create_upload: boolean
  rename_files: boolean
  move_files: boolean
  copy_files: boolean
  delete_files: boolean
  allow_direct_link: boolean
  allow_share: boolean
  extract_files: boolean
  is_admin: boolean
}


export default function FilePreviewContent() {
  const { '*': pathParam } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  
  // 文件预览相关状态
  const [fileInfo, setFileInfo] = useState<FileItem | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [previewers, setPreviewers] = useState<PreviewConfig[]>([])
  const [currentPreviewer, setCurrentPreviewer] = useState<PreviewConfig | null>(null)
  const [audioSiblings, setAudioSiblings] = useState<{ name: string; url: string }[]>([])
  const [videoSiblings, setVideoSiblings] = useState<{ name: string; url: string }[]>([])
  
  const [loading, setLoading] = useState(true)
  const [localIsLoggedIn, setLocalIsLoggedIn] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [userSettingsDialog, setUserSettingsDialog] = useState(false)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  
  // 使用 FileRouter 提供的共享上下文
  const shared = useContext(SharedContext)
  const { siteTitle, siteIcon, darkMode, language, hasBackground, setPageState, setOnPasswordSubmit } = shared
  
  const currentPath = pathParam || ''
  // 元信息相关状态
  const [readme, setReadme] = useState('')
  const [header, setHeader] = useState('')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [pathPassword, setPathPassword] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('pathPasswords') || '{}')
    } catch {
      return {}
    }
  })
  
  const [showLangMenu, setShowLangMenu] = useState(false)

  // 检查路径是否是另一个路径的子路径
  const isSubPath = (parent: string, child: string): boolean => {
    const normalizedParent = parent.endsWith('/') ? parent : parent + '/'
    const normalizedChild = child.endsWith('/') ? child : child + '/'
    return normalizedChild.startsWith(normalizedParent) || parent === child
  }

  // 清除不在当前路径范围内的密码
  const cleanupPasswordsForPath = (currentPathToCheck: string) => {
    const updatedPasswords: Record<string, string> = {}
    let changed = false
    
    for (const [savedPath, pwd] of Object.entries(pathPassword)) {
      if (isSubPath(savedPath, currentPathToCheck)) {
        updatedPasswords[savedPath] = pwd
      } else {
        changed = true
      }
    }
    
    if (changed) {
      setPathPassword(updatedPasswords)
      sessionStorage.setItem('pathPasswords', JSON.stringify(updatedPasswords))
    }
  }

  // 获取路径的密码（包括继承父目录密码）
  const getPasswordForPath = (targetPath: string): string => {
    if (pathPassword[targetPath]) {
      return pathPassword[targetPath]
    }
    const parts = targetPath.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = '/' + parts.slice(0, i).join('/')
      const normalizedParent = parentPath === '' ? '/' : parentPath
      if (pathPassword[normalizedParent]) {
        return pathPassword[normalizedParent]
      }
    }
    if (pathPassword['/']) {
      return pathPassword['/']
    }
    return ''
  }

  // 处理密码提交（接受来自 FileRouter 的密码参数）
  const handlePasswordSubmit = useCallback((password: string) => {
    const fullPath = '/' + currentPath
    const newPasswords = { ...pathPassword, [fullPath]: password }
    setPathPassword(newPasswords)
    sessionStorage.setItem('pathPasswords', JSON.stringify(newPasswords))
    setPageState({ passwordLoading: true })
    loadFileInfo(currentPath, password)
  }, [currentPath, pathPassword, setPageState])

  // 注册密码提交回调到 FileRouter
  useEffect(() => {
    setOnPasswordSubmit(handlePasswordSubmit)
    return () => setOnPasswordSubmit(undefined)
  }, [handlePasswordSubmit, setOnPasswordSubmit])

  // 根据文件名预先设置预览器（不等待文件信息加载完成）
  useEffect(() => {
    if (currentPath) {
      const fileName = currentPath.split('/').pop() || ''
      if (fileName) {
        // 检查加密音频设置
        let encryptedAudioEnabled = false
        try {
          const settings = JSON.parse(localStorage.getItem('audioPreviewSettings') || '{}')
          encryptedAudioEnabled = settings.allowEncryptedAudio || false
        } catch {}
        
        const availablePreviewers = getPreviewers(fileName, encryptedAudioEnabled)
        setPreviewers(availablePreviewers)
        if (availablePreviewers.length > 0 && !currentPreviewer) {
          setCurrentPreviewer(availablePreviewers[0])
        }
      }
    }
  }, [currentPath])

  // 加载文件信息
  const loadFileInfo = async (path: string, password?: string) => {
    if (!path) {
      navigate('/')
      return
    }
    
    setLoading(true)
    setError('')
    
    const fullPath = '/' + path
    const currentPassword = password || getPasswordForPath(fullPath)
    
    try {
      // 获取文件信息
      const infoRes = await api.post('/api/fs/get', { path: fullPath, password: currentPassword })
      
      // 检查游客是否被禁用
      if (infoRes.data.code === 403 && infoRes.data.message === 'guest_disabled') {
        window.location.href = '/login?msg=guest_disabled'
        return
      }
      
      // 检查是否需要密码
      if (infoRes.data.code === 403) {
        setPasswordRequired(true)
        setLoading(false)
        return
      }
      
      if (infoRes.data.code !== 200) {
        setError(infoRes.data.message || '获取文件信息失败')
        setLoading(false)
        return
      }
      
      setPasswordRequired(false)
      const info = infoRes.data.data
      
      // 设置元信息
      setReadme(info.readme || '')
      setHeader(info.header || '')
      
      if (info.is_dir) {
        navigate('/' + path)
        return
      }
      
      setFileInfo({
        name: info.name,
        path: fullPath,
        is_dir: false,
        size: info.size || 0,
        modified: info.modified || ''
      })
      
      // 获取下载链接 / Get download link
      try {
        const linkRes = await api.post('/api/fs/get_download_url', { path: '/' + path })
        if (linkRes.data.code === 200) {
          setDownloadUrl(linkRes.data.data.url)
        }
      } catch {}
      
      // 获取预览器列表（先获取设置）
      let encryptedAudioEnabled = false
      try {
        const settingsRes = await fetch('/api/settings/public')
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          encryptedAudioEnabled = settings.preview_encrypted_audio || false
        }
      } catch {}
      
      const availablePreviewers = getPreviewers(info.name, encryptedAudioEnabled)
      setPreviewers(availablePreviewers)
      if (availablePreviewers.length > 0) {
        setCurrentPreviewer(availablePreviewers[0])
      }
      
      // 检查是否是音频文件，如果是则获取同目录下的音频文件列表
      const fileExt = info.name.split('.').pop()?.toLowerCase() || ''
      if (audioExtensions.includes(fileExt)) {
        try {
          // 获取父目录路径
          const pathParts = path.split('/')
          pathParts.pop() // 移除文件名
          const dirPath = '/' + pathParts.join('/')
          
          // 获取目录文件列表
          const dirRes = await api.post('/api/fs/list', { 
            path: dirPath,
            page: 1,
            per_page: 1000 // 获取足够多的文件
          })
          
          if (dirRes.data.code === 200 && dirRes.data.data?.content) {
            const files = dirRes.data.data.content as FileItem[]
            // 筛选音频文件并获取下载链接
            const audioFiles = files.filter(f => {
              if (f.is_dir) return false
              const ext = f.name.split('.').pop()?.toLowerCase() || ''
              return audioExtensions.includes(ext)
            })
            
            // 按文件名排序
            audioFiles.sort((a, b) => a.name.localeCompare(b.name))
            
            // 批量获取下载链接
            const siblings: { name: string; url: string }[] = []
            for (const audioFile of audioFiles) {
              try {
                const linkRes = await api.post('/api/fs/get_download_url', { 
                  path: dirPath + '/' + audioFile.name 
                })
                if (linkRes.data.code === 200) {
                  siblings.push({
                    name: audioFile.name,
                    url: linkRes.data.data.url
                  })
                }
              } catch {}
            }
            setAudioSiblings(siblings)
          }
        } catch (e) {
          console.warn('Failed to get audio siblings:', e)
        }
      }
      
      // 检查是否是视频文件，如果是则获取同目录下的视频文件列表
      if (videoExtensions.includes(fileExt)) {
        try {
          // 获取父目录路径
          const pathParts = path.split('/')
          pathParts.pop() // 移除文件名
          const dirPath = '/' + pathParts.join('/')
          
          // 获取目录文件列表
          const dirRes = await api.post('/api/fs/list', { 
            path: dirPath,
            page: 1,
            per_page: 1000
          })
          
          if (dirRes.data.code === 200 && dirRes.data.data?.content) {
            const files = dirRes.data.data.content as FileItem[]
            // 筛选视频文件
            const videoFiles = files.filter(f => {
              if (f.is_dir) return false
              const ext = f.name.split('.').pop()?.toLowerCase() || ''
              return videoExtensions.includes(ext)
            })
            
            // 按文件名排序
            videoFiles.sort((a, b) => a.name.localeCompare(b.name))
            
            // 批量获取下载链接
            const siblings: { name: string; url: string }[] = []
            for (const videoFile of videoFiles) {
              try {
                const linkRes = await api.post('/api/fs/get_download_url', { 
                  path: dirPath + '/' + videoFile.name 
                })
                if (linkRes.data.code === 200) {
                  siblings.push({
                    name: videoFile.name,
                    url: linkRes.data.data.url
                  })
                }
              } catch {}
            }
            setVideoSiblings(siblings)
          }
        } catch (e) {
          console.warn('Failed to get video siblings:', e)
        }
      }
      
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFileInfo(currentPath)
  }, [currentPath])

  // 暗色模式切换
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  // 语言切换
  const toggleLanguage = (lang: string) => {
    shared.setLanguage(lang)
    setShowLangMenu(false)
  }

  // 检查登录状态
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/auth/permissions', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          // 游客被禁用时跳转到登录页
          if (data.is_guest && data.guest_disabled) {
            window.location.href = '/login?msg=guest_disabled'
            return
          }
          setLocalIsLoggedIn(!data.is_guest)
          // 检查编辑权限：需要 create_upload 和 delete_files
          if (data.permissions) {
            const hasUpload = !!data.permissions.create_upload
            const hasDelete = !!data.permissions.delete_files
            setCanEdit(hasUpload && hasDelete)
            // 保存完整权限信息
            setPermissions({
              read_files: !!data.permissions.read_files,
              create_upload: !!data.permissions.create_upload,
              rename_files: !!data.permissions.rename_files,
              move_files: !!data.permissions.create_move,
              copy_files: !!data.permissions.create_copy,
              delete_files: !!data.permissions.delete_files,
              allow_direct_link: !!data.permissions.allow_direct_link,
              allow_share: !!data.permissions.allow_share,
              extract_files: !!data.permissions.extract_files,
              is_admin: !!data.permissions.is_admin,
            })
          }
        }
      } catch {}
    }
    checkLogin()
  }, [])

  // 站点设置已移到 FileRouter 加载
  useEffect(() => {
    // 更新页面标题
    if (fileInfo?.name) {
      document.title = `${fileInfo.name} - ${siteTitle}`
    }
  }, [fileInfo, siteTitle])


  // 面包屑
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: t('fileBrowser.home'), path: '' }]
    const parts = currentPath.split('/').filter(Boolean)
    const breadcrumbs = [{ name: t('fileBrowser.home'), path: '' }]
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      breadcrumbs.push({ name: decodeURIComponent(part), path })
    })
    return breadcrumbs
  }

  // 预览器切换菜单状态
  const [showPreviewMenu, setShowPreviewMenu] = useState(false)

  // 同步加载状态到 FileRouter
  useEffect(() => {
    setPageState({ contentLoading: loading })
  }, [loading, setPageState])

  // 只在加载完成后同步元信息，避免加载过程中清空元信息卡片
  useEffect(() => {
    if (!loading) {
      setPageState({ header, readme, passwordRequired })
    }
  }, [header, readme, passwordRequired, loading, setPageState])

  // FilePreviewContent 只渲染 main-card 内部内容
  // 公共部分（header、面包屑、meta-card、page-footer、密码验证界面）由 FileRouter 处理

  // 加载动画由 FileRouter 渲染，这里不再渲染
  return (
    <>
      {/* 预览模式选择器（不等待文件信息加载完成） */}
      {previewers.length > 0 && (
        <div className="file-preview__toolbar">
          <FilePreviewDropdown
            label={currentPreviewer?.name ? t(currentPreviewer.name) : t('filePreview.selectPreviewMode')}
            open={showPreviewMenu}
            onOpenChange={setShowPreviewMenu}
          >
            {previewers.map(p => (
              <button
                type="button"
                key={p.name}
                className={`file-preview__dropdown-item ${currentPreviewer?.name === p.name ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPreviewer(p)
                  setShowPreviewMenu(false)
                }}
              >
                {t(p.name)}
              </button>
            ))}
          </FilePreviewDropdown>
          {/* 文本预览状态信息插槽 */}
          <div id="text-preview-status-slot" className="file-preview__status-slot"></div>
        </div>
      )}

      {error ? (
          <div className="file-browser__empty">
            <File size={48} />
            <p>{error}</p>
          </div>
        ) : fileInfo && downloadUrl ? (
          <>
            {/* 预览内容 */}
            {currentPreviewer && (
              <div className="file-preview__content">
                <Suspense fallback={null}>
                  <currentPreviewer.component 
                    file={fileInfo}
                    url={downloadUrl}
                    canEdit={canEdit}
                    siblings={audioSiblings.length > 0 ? audioSiblings : videoSiblings}
                  />
                </Suspense>
              </div>
            )}
          </>
        ) : fileInfo && !downloadUrl ? (
          <div className="file-browser__loading">
            <div className="file-browser__spinner"></div>
          </div>
        ) : null}
    </>
  )
}
