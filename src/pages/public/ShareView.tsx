import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import JSZip from 'jszip'
import { 
  Share2, Lock, Folder, File, Download, FileText, FileImage, 
  FileVideo, FileAudio, FileArchive, FileCode, ChevronRight, Home,
  AlertCircle, Sun, Moon, Languages, ChevronLeft, FileSpreadsheet,
  Presentation, Disc, HardDrive, Terminal, Database, Settings,
  Package, Check, ChevronDown, Loader2
} from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../components/Toast'
import FixedAnchoredMenu from '../../components/FixedAnchoredMenu'
import { applyThemeTransition } from '../../utils/themeTransition'
import '../../styles/pages/share-view.scss'

interface ShareInfo {
  name: string
  is_dir: boolean
  has_password: boolean
  creator_name: string
  created_at: string
  expires_at: string | null
}

interface FileItem {
  name: string
  size: number
  is_dir: boolean
  modified: string | null
}

// 文件扩展名到图标的映射（与FileBrowser保持一致）
const getFileIcon = (filename: string, isDir: boolean) => {
  if (isDir) return { icon: Folder, color: '#d4a574' }
  
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  // Word 文档
  if (['doc', 'docx', 'docm', 'dotx', 'dotm', 'odt', 'rtf'].includes(ext)) {
    return { icon: FileText, color: '#2b579a' }
  }
  // Excel 表格
  if (['xls', 'xlsx', 'xlsm', 'xltx', 'csv', 'ods'].includes(ext)) {
    return { icon: FileSpreadsheet, color: '#217346' }
  }
  // PowerPoint 演示
  if (['ppt', 'pptx', 'pptm', 'potx', 'odp', 'key'].includes(ext)) {
    return { icon: Presentation, color: '#d24726' }
  }
  // PDF
  if (['pdf'].includes(ext)) {
    return { icon: FileText, color: '#ff0000' }
  }
  // 纯文本
  if (['txt', 'log', 'nfo', 'readme'].includes(ext)) {
    return { icon: FileText, color: '#6b7280' }
  }
  // Markdown
  if (['md', 'mdx', 'markdown'].includes(ext)) {
    return { icon: FileText, color: '#083fa1' }
  }
  
  // 图片
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif', 'jxl',
       'heic', 'heif', 'tiff', 'tif', 'raw', 'cr2', 'cr3', 'nef', 'nrw', 'arw',
       'srf', 'sr2', 'dng', 'orf', 'rw2', 'raf', 'pef', 'ptx', '3fr', 'iiq',
       'erf', 'srw', 'x3f', 'kdc', 'dcr', 'rwl', 'mos', 'mrw', 'hdr', 'exr'].includes(ext)) {
    return { icon: FileImage, color: '#e91e8c' }
  }
  // Adobe Photoshop
  if (['psd', 'psb'].includes(ext)) {
    return { icon: FileImage, color: '#31a8ff' }
  }
  // Adobe Illustrator
  if (['ai', 'eps'].includes(ext)) {
    return { icon: FileImage, color: '#ff9a00' }
  }
  
  // 视频
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg', '3gp', 'ts', 'mts', 'm2ts', 'vob'].includes(ext)) {
    return { icon: FileVideo, color: '#9333ea' }
  }
  // 流媒体/播放列表
  if (['m3u8', 'm3u', 'pls', 'xspf'].includes(ext)) {
    return { icon: FileVideo, color: '#7c3aed' }
  }
  
  // 音频
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'ape', 'alac', 'aiff', 'opus', 'mid', 'midi'].includes(ext)) {
    return { icon: FileAudio, color: '#06b6d4' }
  }
  // 加密音频
  if (['ncm', 'qmc0', 'qmc2', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mflac0', 'mgg', 'mgg1', 'kgm', 'kgma', 'vpr', 'kwm'].includes(ext)) {
    return { icon: FileAudio, color: '#0891b2' }
  }
  
  // 压缩包
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma', 'zst', 'cab', 'arj', 'lzh', 'ace', 'uue', 'jar', 'war', 'apk', 'ipa'].includes(ext)) {
    return { icon: FileArchive, color: '#d97706' }
  }
  
  // 光盘镜像
  if (['iso', 'img', 'bin', 'cue', 'mdf', 'mds', 'nrg', 'ccd', 'sub'].includes(ext)) {
    return { icon: Disc, color: '#7dd3fc' }
  }
  // 虚拟机磁盘
  if (['vmdk', 'vdi', 'vhd', 'vhdx', 'qcow', 'qcow2', 'hdd', 'ova', 'ovf'].includes(ext)) {
    return { icon: HardDrive, color: '#475569' }
  }
  
  // 代码文件
  if (['js', 'mjs', 'cjs'].includes(ext)) return { icon: FileCode, color: '#f7df1e' }
  if (['ts', 'tsx'].includes(ext)) return { icon: FileCode, color: '#3178c6' }
  if (['jsx'].includes(ext)) return { icon: FileCode, color: '#61dafb' }
  if (['vue'].includes(ext)) return { icon: FileCode, color: '#42b883' }
  if (['py', 'pyw', 'pyx'].includes(ext)) return { icon: FileCode, color: '#3776ab' }
  if (['java', 'class', 'jsp'].includes(ext)) return { icon: FileCode, color: '#ed8b00' }
  if (['c', 'h'].includes(ext)) return { icon: FileCode, color: '#a8b9cc' }
  if (['cpp', 'cc', 'cxx', 'hpp', 'hxx'].includes(ext)) return { icon: FileCode, color: '#00599c' }
  if (['cs'].includes(ext)) return { icon: FileCode, color: '#512bd4' }
  if (['go'].includes(ext)) return { icon: FileCode, color: '#00add8' }
  if (['rs'].includes(ext)) return { icon: FileCode, color: '#dea584' }
  if (['rb', 'erb'].includes(ext)) return { icon: FileCode, color: '#cc342d' }
  if (['php'].includes(ext)) return { icon: FileCode, color: '#777bb4' }
  if (['swift'].includes(ext)) return { icon: FileCode, color: '#fa7343' }
  if (['kt', 'kts'].includes(ext)) return { icon: FileCode, color: '#7f52ff' }
  if (['html', 'htm', 'xhtml'].includes(ext)) return { icon: FileCode, color: '#e34f26' }
  if (['css'].includes(ext)) return { icon: FileCode, color: '#1572b6' }
  if (['scss', 'sass', 'less', 'styl'].includes(ext)) return { icon: FileCode, color: '#cc6699' }
  if (['json', 'jsonc', 'json5'].includes(ext)) return { icon: FileCode, color: '#292929' }
  if (['xml', 'xsl', 'xslt'].includes(ext)) return { icon: FileCode, color: '#ff6600' }
  if (['yaml', 'yml'].includes(ext)) return { icon: FileCode, color: '#cb171e' }
  if (['toml'].includes(ext)) return { icon: FileCode, color: '#9c4121' }
  
  // Shell 脚本
  if (['sh', 'bash', 'zsh', 'fish', 'ksh', 'csh', 'tcsh'].includes(ext)) {
    return { icon: Terminal, color: '#4eaa25' }
  }
  // Windows 脚本
  if (['bat', 'cmd', 'ps1', 'psm1', 'psd1'].includes(ext)) {
    return { icon: Terminal, color: '#012456' }
  }
  
  // 数据库
  if (['db', 'sqlite', 'sqlite3', 'sql', 'mdb', 'accdb'].includes(ext)) {
    return { icon: Database, color: '#336791' }
  }
  
  // 配置文件
  if (['ini', 'conf', 'cfg', 'config', 'env', 'properties', 'plist'].includes(ext)) {
    return { icon: Settings, color: '#6b7280' }
  }
  
  // 可执行文件
  if (['exe', 'msi', 'dll', 'sys', 'com'].includes(ext)) {
    return { icon: Terminal, color: '#0078d4' }
  }
  if (['app', 'dmg', 'pkg'].includes(ext)) {
    return { icon: Terminal, color: '#999999' }
  }
  if (['deb', 'rpm', 'flatpak', 'snap', 'appimage'].includes(ext)) {
    return { icon: Terminal, color: '#dd4814' }
  }
  
  // 字体
  if (['ttf', 'otf', 'woff', 'woff2', 'eot', 'fon'].includes(ext)) {
    return { icon: FileText, color: '#4a5568' }
  }
  
  // 电子书
  if (['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu'].includes(ext)) {
    return { icon: FileText, color: '#f59e0b' }
  }
  
  return { icon: File, color: 'var(--text-tertiary)' }
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function ShareView() {
  const { shortId } = useParams<{ shortId: string }>()
  const { t, i18n } = useTranslation()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [needPassword, setNeedPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [verified, setVerified] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [_sharePath, setSharePath] = useState('')
  const [_downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [isPackaging, setIsPackaging] = useState(false)
  
  // 多选状态
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [allFileNames, setAllFileNames] = useState<string[]>([])  // 目录下所有文件名
  const [showPageSizeMenu, setShowPageSizeMenu] = useState(false)
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'name' | 'modified' | 'size'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [filesLoading, setFilesLoading] = useState(false)
  
  // 站点设置
  const [siteTitle, setSiteTitle] = useState('YaoList')
  const [siteIcon, setSiteIcon] = useState('/favicon.ico')
  const [backgroundImage, setBackgroundImage] = useState('')
  
  // 主题和语言
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [showLangMenu, setShowLangMenu] = useState(false)
  const langAnchorRef = useRef<HTMLDivElement>(null)
  
  // 加载站点设置（使用公开API）
  useEffect(() => {
    const loadSiteSettings = async () => {
      try {
        const response = await api.get('/api/settings/public')
        if (response.data) {
          setSiteTitle(response.data.site_title || 'YaoList')
          setSiteIcon(response.data.site_icon || '/favicon.ico')
          setBackgroundImage(response.data.background_image || '')
        }
      } catch (err) {
        // 使用默认值
      }
    }
    loadSiteSettings()
  }, [])
  
  // 主题切换
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])
  
  const toggleTheme = (origin?: { x: number; y: number }) => {
    applyThemeTransition(() => setIsDark((d) => !d), origin)
  }
  
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
    setShowLangMenu(false)
  }
  
  // 背景样式（浅色模式下显示背景图片）
  const hasBackground = !isDark && backgroundImage
  const bgStyle = hasBackground ? { backgroundImage: `url(${backgroundImage})` } : {}

  useEffect(() => {
    loadShareInfo()
  }, [shortId])

  const loadShareInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/api/share/${shortId}/info`)
      if (response.data.code === 200) {
        setShareInfo(response.data.data)
        if (response.data.data.has_password) {
          setNeedPassword(true)
        } else {
          // 无密码，直接验证并加载文件
          await verifyAndLoadFiles('')
        }
      }
    } catch (err: any) {
      const errorData = err.response?.data
      if (errorData?.code) {
        setError({ code: errorData.code, message: errorData.message })
      } else {
        setError({ code: 'ERROR', message: t('share.loadFailed', '加载失败') })
      }
    } finally {
      setLoading(false)
    }
  }

  const verifyAndLoadFiles = async (pwd: string) => {
    try {
      const response = await api.post(`/api/share/${shortId}/verify`, { password: pwd || null })
      if (response.data.code === 200) {
        setVerified(true)
        setNeedPassword(false)
        setSharePath(response.data.data.path)
        // 加载文件列表
        await loadFiles('')
      }
    } catch (err: any) {
      const errorData = err.response?.data
      if (errorData?.code === 'WRONG_PASSWORD') {
        setPasswordError(true)
        toast.error(t('share.wrongPassword', '提取码错误'))
      } else {
        toast.error(errorData?.message || t('share.verifyFailed', '验证失败'))
      }
    }
  }

  const loadFiles = async (subPath: string, pageNum: number = 1, perPage?: number, sort?: string, order?: string) => {
    setFilesLoading(true)
    // 切换目录时清空选中状态
    if (subPath !== currentPath) {
      setSelectedFiles(new Set())
    }
    const actualPerPage = perPage ?? pageSize
    const actualSortBy = sort ?? sortBy
    const actualSortOrder = order ?? sortOrder
    try {
      const response = await api.post(`/api/share/${shortId}/files`, { 
        sub_path: subPath || null,
        page: pageNum,
        per_page: actualPerPage,
        sort_by: actualSortBy,
        sort_order: actualSortOrder
      })
      if (response.data.code === 200) {
        const fileList = response.data.data.files || []
        setFiles(fileList)
        setCurrentPath(subPath)
        setTotal(response.data.data.total || fileList.length)
        setPage(pageNum)
        // 保存目录下所有文件名用于全选
        setAllFileNames(response.data.data.all_names || fileList.map((f: FileItem) => f.name))
      }
    } catch (err: any) {
      const errorData = err.response?.data
      if (errorData?.code === 'DRIVER_ERROR') {
        setError({ code: 'DRIVER_ERROR', message: errorData.message || t('share.driverError', '存储驱动故障') })
      } else {
        toast.error(t('share.loadFilesFailed', '加载文件列表失败'))
      }
    } finally {
      setFilesLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(false)
    await verifyAndLoadFiles(password)
  }

  const handleFileClick = (file: FileItem) => {
    if (file.is_dir) {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name
      loadFiles(newPath, 1)
    }
  }
  
  const handlePageChange = (newPage: number) => {
    loadFiles(currentPath, newPage)
  }

  const handleDownload = async (file: FileItem) => {
    setDownloadingFile(file.name)
    try {
      // 获取临时下载链接
      const subPath = currentPath || ''
      const response = await api.get(`/api/share/${shortId}/download/${encodeURIComponent(file.name)}?sub_path=${encodeURIComponent(subPath)}`)
      if (response.data.code === 200) {
        // 打开下载链接
        window.open(response.data.data.url, '_blank')
      }
    } catch (err) {
      toast.error(t('share.downloadFailed', '获取下载链接失败'))
    } finally {
      setDownloadingFile(null)
    }
  }

  // 递归获取文件夹内所有文件
  const fetchFolderFiles = async (folderPath: string): Promise<{name: string, path: string}[]> => {
    const result: {name: string, path: string}[] = []
    try {
      const response = await api.post(`/api/share/${shortId}/files`, { 
        sub_path: folderPath || null,
        page: 1,
        per_page: 1000 // 获取所有文件
      })
      if (response.data.code === 200) {
        const items = response.data.data.files || []
        for (const item of items) {
          const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name
          if (item.is_dir) {
            // 递归获取子文件夹
            const subFiles = await fetchFolderFiles(itemPath)
            result.push(...subFiles)
          } else {
            result.push({ name: item.name, path: itemPath })
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch folder ${folderPath}:`, err)
    }
    return result
  }

  // 批量打包下载
  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) {
      toast.info(t('share.selectToDownload', '请选择要下载的文件'))
      return
    }

    // 获取选中的文件和文件夹
    const selectedItems = files.filter(f => selectedFiles.has(f.name))
    
    // 单个非目录文件直接下载
    if (selectedItems.length === 1 && !selectedItems[0].is_dir) {
      handleDownload(selectedItems[0])
      return
    }

    setIsPackaging(true)
    toast.info(t('share.packagingWarning', '正在打包文件，大文件可能需要较长时间，请勿刷新页面...'))

    try {
      const zip = new JSZip()
      const basePath = currentPath || ''
      
      // 收集所有要下载的文件（包括文件夹内的文件）
      const allFiles: {name: string, path: string, zipPath: string}[] = []
      
      for (const item of selectedItems) {
        const itemPath = basePath ? `${basePath}/${item.name}` : item.name
        if (item.is_dir) {
          // 递归获取文件夹内所有文件
          const folderFiles = await fetchFolderFiles(itemPath)
          for (const f of folderFiles) {
            // ZIP内路径：文件夹名/相对路径
            const relativePath = f.path.substring(itemPath.length).replace(/^\//, '')
            allFiles.push({ 
              name: f.name, 
              path: f.path,
              zipPath: `${item.name}/${relativePath}`
            })
          }
        } else {
          allFiles.push({ name: item.name, path: itemPath, zipPath: item.name })
        }
      }

      if (allFiles.length === 0) {
        toast.info(t('share.noFilesToDownload', '没有可下载的文件'))
        setIsPackaging(false)
        return
      }

      // 逐个获取文件并添加到ZIP
      for (const file of allFiles) {
        try {
          const subPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''
          const response = await api.get(`/api/share/${shortId}/download/${encodeURIComponent(file.name)}?sub_path=${encodeURIComponent(subPath)}`)
          if (response.data.code === 200) {
            const url = response.data.data.url
            const fileResponse = await fetch(url)
            const blob = await fileResponse.blob()
            zip.file(file.zipPath, blob)
          }
        } catch (err) {
          console.error(`Failed to download ${file.name}:`, err)
        }
      }

      // 生成ZIP文件
      const content = await zip.generateAsync({ type: 'blob' })
      
      // 触发下载
      const downloadUrl = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${shareInfo?.name || 'files'}_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      toast.success(t('share.downloadComplete', '下载完成'))
    } catch (err) {
      toast.error(t('share.packageFailed', '打包下载失败'))
    } finally {
      setIsPackaging(false)
    }
  }

  const navigateToPath = (index: number) => {
    if (index === -1) {
      loadFiles('', 1)
    } else {
      const parts = currentPath.split('/').filter(Boolean)
      const newPath = parts.slice(0, index + 1).join('/')
      loadFiles(newPath, 1)
    }
  }
  
  const totalPages = Math.ceil(total / pageSize)

  const [footerUsername, setFooterUsername] = useState<string | null>(null)
  const [footerLoggedIn, setFooterLoggedIn] = useState(false)

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const res = await fetch('/api/auth/permissions', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setFooterLoggedIn(!data.is_guest)
        setFooterUsername(data.user?.username ?? null)
      } catch {}
    }
    loadAuth()
  }, [])

  const footerElement = (
    <div className="share-view__footer">
      {footerLoggedIn && footerUsername && (
        <>
          <span className="share-view__footer-user">{footerUsername}</span>
          <span className="share-view__footer-sep">|</span>
        </>
      )}
      <Link to="/" className="share-view__footer-link">
        {t('share.goHome', '前往主页')}
      </Link>
    </div>
  )

  // 工具栏组件（与FileBrowser保持一致）
  const Toolbar = () => (
    <div className="share-view__toolbar">
      <div className="share-view__site-info">
        <img src={siteIcon} alt={siteTitle} className="share-view__site-icon" />
        <span className="share-view__site-title">{siteTitle}</span>
      </div>
      <div className="share-view__toolbar-actions">
        <div className="share-view__lang-switch" ref={langAnchorRef}>
          <button 
            className="share-view__toolbar-btn" 
            onClick={() => setShowLangMenu(!showLangMenu)} 
            title={t('tooltip.languageSwitch', '切换语言')}
          >
            <Languages size={18} />
          </button>
          <FixedAnchoredMenu
            open={showLangMenu}
            anchorRef={langAnchorRef}
            className="share-view__lang-menu"
            align="end"
          >
            <button 
              className={`share-view__lang-item ${i18n.language === 'zh-CN' ? 'active' : ''}`}
              onClick={() => changeLanguage('zh-CN')}
            >
              简体中文
            </button>
            <button 
              className={`share-view__lang-item ${i18n.language.startsWith('en') ? 'active' : ''}`}
              onClick={() => changeLanguage('en-US')}
            >
              English
            </button>
          </FixedAnchoredMenu>
        </div>
        <button 
          className="share-view__toolbar-btn" 
          onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })} 
          title={isDark ? t('fileBrowser.switchToLight', '切换到浅色模式') : t('fileBrowser.switchToDark', '切换到暗色模式')}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  )

  // 错误页面
  if (error) {
    return (
      <div className={`share-view ${hasBackground ? 'share-view--with-bg' : ''}`} style={bgStyle}>
        <Toolbar />
        <div className="share-view__error">
          <AlertCircle size={64} strokeWidth={1.5} />
          <h2>
            {error.code === 'NOT_FOUND' && t('share.notFound', '分享不存在')}
            {error.code === 'DISABLED' && t('share.disabled', '分享已被禁用')}
            {error.code === 'EXPIRED' && t('share.expired', '分享已过期')}
            {error.code === 'EXHAUSTED' && t('share.exhausted', '分享访问次数已达上限')}
            {error.code === 'DRIVER_ERROR' && t('share.driverError', '存储驱动故障')}
            {!['NOT_FOUND', 'DISABLED', 'EXPIRED', 'EXHAUSTED', 'DRIVER_ERROR'].includes(error.code) && error.message}
          </h2>
          <p>{error.code === 'DRIVER_ERROR' ? t('share.driverErrorDesc', '请联系管理员') : error.message}</p>
        </div>
        {footerElement}
      </div>
    )
  }

  // 加载中
  if (loading) {
    return (
      <div className={`share-view ${hasBackground ? 'share-view--with-bg' : ''}`} style={bgStyle}>
        <Toolbar />
        <div className="share-view__loading">
          <div className="share-view__spinner"></div>
          <p>{t('common.loading', '加载中...')}</p>
        </div>
        {footerElement}
      </div>
    )
  }

  // 需要密码
  if (needPassword && !verified) {
    return (
      <div className={`share-view ${hasBackground ? 'share-view--with-bg' : ''}`} style={bgStyle}>
        <Toolbar />
        <div className="share-view__password-card">
          <div className="share-view__password-header">
            <Share2 size={32} />
            <h2>{shareInfo?.creator_name || t('share.anonymous', '匿名用户')} {t('share.sharedWith', '分享的')}{shareInfo?.is_dir ? t('share.folder', '文件夹') : t('share.file', '文件')}</h2>
            <p className="share-view__share-name">{shareInfo?.name}</p>
            <span className="share-view__share-time">
              {shareInfo?.created_at ? formatDate(shareInfo.created_at) : '-'}
            </span>
          </div>
          <form onSubmit={handlePasswordSubmit} className="share-view__password-form">
            <div className="share-view__password-field">
              <Lock size={20} />
              <input
                type="text"
                placeholder={t('share.enterPassword', '请输入提取码')}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(false) }}
                className={passwordError ? 'error' : ''}
                autoFocus
                maxLength={6}
              />
            </div>
            <button type="submit" className="share-view__password-btn">
              {t('share.access', '访问')}
            </button>
          </form>
        </div>
        {footerElement}
      </div>
    )
  }

  // 文件列表
  return (
    <div className={`share-view ${hasBackground ? 'share-view--with-bg' : ''}`} style={bgStyle}>
      <Toolbar />
      <div className="share-view__container">
        <div className="share-view__header">
          <div className="share-view__title">
            <Share2 size={24} />
            <div>
              <h1>{shareInfo?.name}</h1>
              <p>
                {shareInfo?.creator_name || t('share.anonymous', '匿名用户')} {t('share.sharedWith', '分享的')}{shareInfo?.is_dir ? t('share.folder', '文件夹') : t('share.file', '文件')}
                {shareInfo?.created_at && <span className="share-view__title-time"> · {formatDate(shareInfo.created_at)}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* 面包屑导航 */}
        {shareInfo?.is_dir && (
          <div className="share-view__breadcrumb">
            <button onClick={() => navigateToPath(-1)}>
              <Home size={14} />
            </button>
            {currentPath && currentPath.split('/').filter(Boolean).map((part, index) => (
              <div key={index} className="share-view__breadcrumb-item">
                <span className="share-view__breadcrumb-sep">
                  <ChevronRight size={14} />
                </span>
                <button onClick={() => navigateToPath(index)}>{part}</button>
              </div>
            ))}
          </div>
        )}

        {/* 文件列表 */}
        <div className="share-view__files">
          {filesLoading ? (
            <div className="share-view__files-loading">
              <div className="share-view__spinner"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="share-view__empty">
              <Folder size={48} strokeWidth={1.5} />
              <p>{t('share.emptyFolder', '文件夹为空')}</p>
            </div>
          ) : (
            <>
              {/* 表头：全选 + 排序 */}
              <div className="share-view__table-header">
                <div 
                  className={`share-view__checkbox ${selectedFiles.size === allFileNames.length && allFileNames.length > 0 ? 'share-view__checkbox--checked' : ''}`}
                  onClick={() => {
                    if (selectedFiles.size === allFileNames.length) {
                      setSelectedFiles(new Set())
                    } else {
                      setSelectedFiles(new Set(allFileNames))
                    }
                  }}
                >
                  {selectedFiles.size === allFileNames.length && allFileNames.length > 0 && <Check size={12} />}
                </div>
                <div 
                  className={`share-view__sort-col share-view__sort-col--name ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => { 
                    const newOrder = sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'
                    setSortBy('name')
                    setSortOrder(newOrder)
                    loadFiles(currentPath, 1, pageSize, 'name', newOrder)
                  }}
                >
                  {t('share.fileName', '文件名')}
                  {sortBy === 'name' && <ChevronDown size={14} className={sortOrder === 'desc' ? 'rotated' : ''} />}
                </div>
                <div 
                  className={`share-view__sort-col share-view__sort-col--modified ${sortBy === 'modified' ? 'active' : ''}`}
                  onClick={() => { 
                    const newOrder = sortBy === 'modified' && sortOrder === 'asc' ? 'desc' : 'asc'
                    setSortBy('modified')
                    setSortOrder(newOrder)
                    loadFiles(currentPath, 1, pageSize, 'modified', newOrder)
                  }}
                >
                  {t('share.modifiedTime', '修改时间')}
                  {sortBy === 'modified' && <ChevronDown size={14} className={sortOrder === 'desc' ? 'rotated' : ''} />}
                </div>
                <div 
                  className={`share-view__sort-col share-view__sort-col--size ${sortBy === 'size' ? 'active' : ''}`}
                  onClick={() => { 
                    const newOrder = sortBy === 'size' && sortOrder === 'asc' ? 'desc' : 'asc'
                    setSortBy('size')
                    setSortOrder(newOrder)
                    loadFiles(currentPath, 1, pageSize, 'size', newOrder)
                  }}
                >
                  {t('share.fileSize', '大小')}
                  {sortBy === 'size' && <ChevronDown size={14} className={sortOrder === 'desc' ? 'rotated' : ''} />}
                </div>
              </div>
              {/* 文件列表 - 后端已排序，直接渲染 */}
              {files.map((file, index) => {
                const { icon: Icon, color } = getFileIcon(file.name, file.is_dir)
                const isSelected = selectedFiles.has(file.name)
                return (
                  <div 
                    key={index} 
                    className={`share-view__file-row ${isSelected ? 'share-view__file-row--selected' : ''}`}
                    onClick={() => file.is_dir && handleFileClick(file)}
                  >
                    <div 
                      className={`share-view__checkbox ${isSelected ? 'share-view__checkbox--checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const newSelected = new Set(selectedFiles)
                        if (isSelected) {
                          newSelected.delete(file.name)
                        } else {
                          newSelected.add(file.name)
                        }
                        setSelectedFiles(newSelected)
                      }}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                    <div className="share-view__file-cell share-view__file-cell--name">
                      <Icon size={18} style={{ color }} />
                      <span>{file.name}</span>
                    </div>
                    <div className="share-view__file-cell share-view__file-cell--modified">
                      {file.modified ? formatDate(file.modified) : '-'}
                    </div>
                    <div className="share-view__file-cell share-view__file-cell--size">
                      {file.is_dir ? '-' : formatSize(file.size)}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* 底部操作区：分页 + 下载按钮 */}
        <div className="share-view__footer-bar">
          <div className="share-view__pager">
            <span className="share-view__pager-text">{total} {t('common.items', '项')}</span>
            <div className="share-view__pager-nav">
              <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                <ChevronLeft size={16} />
              </button>
              <span>{page}/{totalPages || 1}</span>
              <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="share-view__pager-size" onClick={() => setShowPageSizeMenu(!showPageSizeMenu)}>
              <span>{pageSize}</span>
              <ChevronDown size={12} className={showPageSizeMenu ? 'rotated' : ''} />
              {showPageSizeMenu && (
                <div className="share-view__pager-dropdown">
                  {[10, 20, 50, 100].map(size => (
                    <div 
                      key={size}
                      className={`share-view__pager-dropdown-item ${pageSize === size ? 'active' : ''}`}
                      onClick={(e) => { 
                        e.stopPropagation()
                        setPageSize(size)
                        setPage(1)
                        loadFiles(currentPath, 1, size)
                        setShowPageSizeMenu(false)
                      }}
                    >
                      {size}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button 
            className={`share-view__action-btn ${isPackaging ? 'share-view__action-btn--loading' : ''}`}
            onClick={handleBatchDownload}
            disabled={isPackaging}
          >
            {isPackaging ? (
              <>
                <Loader2 size={18} className="spinning" />
                {t('share.packaging', '打包中...')}
              </>
            ) : (
              <>
                {selectedFiles.size > 1 ? <Package size={18} /> : <Download size={18} />}
                {selectedFiles.size > 1 
                  ? t('share.batchDownload', '打包下载') + ` (${selectedFiles.size})`
                  : selectedFiles.size === 1 
                    ? t('share.download', '下载')
                    : t('share.download', '下载')
                }
              </>
            )}
          </button>
        </div>
      </div>
      {footerElement}
    </div>
  )
}
