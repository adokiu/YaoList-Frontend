import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Folder, FolderOpen, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../utils/api'
import { useToast } from './Toast'

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

interface FileItem {
  name: string
  is_dir: boolean
  size: number
  modified: string
}

interface ExtractDialogProps {
  visible: boolean
  fileName: string
  sourcePath: string  // 压缩文件所在目录
  onClose: () => void
  onSuccess?: () => void
}

export function ExtractDialog({ visible, fileName, sourcePath, onClose, onSuccess }: ExtractDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  
  const [targetPath, setTargetPath] = useState('/')
  const [currentDir, setCurrentDir] = useState('/')
  const [dirs, setDirs] = useState<FileItem[]>([])
  const [password, setPassword] = useState('')
  const [encoding, setEncoding] = useState('utf-8')
  const [putIntoNewDir, setPutIntoNewDir] = useState(true)
  const [overwrite, setOverwrite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 加载目录列表
  const loadDirs = async (path: string) => {
    setLoading(true)
    try {
      const response = await api.post('/api/fs/list', { path: path || '/', page: 1, per_page: 999, refresh: false })
      const dirList = (response.data.data?.content || []).filter((f: FileItem) => f.is_dir)
      setDirs(dirList)
      setCurrentDir(path)
      setTargetPath(path)
    } catch {
      toast.error(t('fileBrowser.operationFailed'))
    }
    setLoading(false)
  }

  // 初始化加载
  useEffect(() => {
    if (visible) {
      // 默认解压到压缩文件所在目录
      const initialPath = sourcePath || '/'
      setTargetPath(initialPath)
      setCurrentDir(initialPath)
      loadDirs(initialPath)
      setPassword('')
      setEncoding('utf-8')
      setPutIntoNewDir(true)
      setOverwrite(false)
    }
  }, [visible, sourcePath])

  // 执行解压
  const handleExtract = async () => {
    setSubmitting(true)
    try {
      const srcPath = sourcePath === '/' ? `/${fileName}` : `${sourcePath}/${fileName}`
      const response = await api.post('/api/fs/extract', {
        src_path: srcPath,
        dst_path: targetPath || '/',
        password: password || undefined,
        path_password: getPathPassword(srcPath) || undefined,
        encoding: encoding,
        put_into_new_dir: putIntoNewDir,
        overwrite: overwrite
      })
      if (response.data.code === 200) {
        toast.success(t('fileBrowser.extractStarted') || '解压任务已创建')
        onSuccess?.()
        onClose()
      } else {
        toast.error(response.data.message || t('fileBrowser.operationFailed'))
      }
    } catch {
      toast.error(t('fileBrowser.operationFailed'))
    }
    setSubmitting(false)
  }

  if (!visible) return null

  return createPortal(
    <div className="extract-dialog__overlay" onClick={onClose}>
      <div className="extract-dialog" onClick={e => e.stopPropagation()}>
        <div className="extract-dialog__header">
          <h3>{t('fileBrowser.extractTo') || '解压到'}: {fileName}</h3>
          <button className="extract-dialog__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="extract-dialog__content">
          {/* 目标路径选择 */}
          <div className="extract-dialog__section">
            <label>{t('fileBrowser.targetPath') || '目标路径'}</label>
            <div className="extract-dialog__current-path">
              <Folder size={16} />
              <span>{targetPath || '/'}</span>
            </div>
            <div className="extract-dialog__dir-list">
              {currentDir !== '/' && (
                <div 
                  className="extract-dialog__dir-item extract-dialog__dir-item--back"
                  onClick={() => {
                    const parts = currentDir.split('/').filter(Boolean)
                    parts.pop()
                    loadDirs(parts.length ? '/' + parts.join('/') : '/')
                  }}
                >
                  <FolderOpen size={16} /> {t('fileBrowser.goBack') || '返回上级'}
                </div>
              )}
              {loading ? (
                <div className="extract-dialog__loading">{t('common.loading') || '加载中...'}</div>
              ) : (
                dirs.map(dir => (
                  <div 
                    key={dir.name}
                    className="extract-dialog__dir-item"
                    onClick={() => {
                      const newPath = currentDir === '/' ? `/${dir.name}` : `${currentDir}/${dir.name}`
                      loadDirs(newPath)
                    }}
                  >
                    <Folder size={16} />
                    <span>{dir.name}</span>
                    <ChevronRight size={14} className="extract-dialog__dir-arrow" />
                  </div>
                ))
              )}
              {!loading && dirs.length === 0 && currentDir !== '/' && (
                <div className="extract-dialog__empty">{t('fileBrowser.noSubfolders') || '此目录下没有子文件夹'}</div>
              )}
            </div>
          </div>

          {/* 密码输入 */}
          <div className="extract-dialog__section">
            <label>{t('fileBrowser.archivePassword') || '压缩包密码'}</label>
            <input 
              type="password"
              className="extract-dialog__input"
              placeholder={t('fileBrowser.passwordPlaceholder') || '如果有密码请输入，否则留空'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {/* 编码选择 */}
          <div className="extract-dialog__section">
            <label>{t('fileBrowser.filenameEncoding') || '文件名编码'}</label>
            <select 
              className="extract-dialog__select"
              value={encoding}
              onChange={e => setEncoding(e.target.value)}
            >
              <option value="utf-8">UTF-8 (推荐)</option>
              <option value="gbk">GBK (简体中文)</option>
              <option value="gb2312">GB2312 (简体中文)</option>
              <option value="gb18030">GB18030 (简体中文)</option>
              <option value="big5">Big5 (繁体中文)</option>
              <option value="shift_jis">Shift_JIS (日文)</option>
              <option value="euc-kr">EUC-KR (韩文)</option>
            </select>
            <div className="extract-dialog__hint">
              {t('fileBrowser.encodingHint') || '如果解压后文件名乱码，请尝试其他编码'}
            </div>
          </div>

          {/* 选项 */}
          <div className="extract-dialog__section">
            <label>{t('fileBrowser.extractOptions') || '解压选项'}</label>
            <div className="extract-dialog__options">
              <label className="extract-dialog__checkbox">
                <input 
                  type="checkbox"
                  checked={putIntoNewDir}
                  onChange={e => setPutIntoNewDir(e.target.checked)}
                />
                <span>{t('fileBrowser.putIntoNewDir') || '解压到以压缩包命名的文件夹'}</span>
              </label>
              <label className="extract-dialog__checkbox">
                <input 
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                />
                <span>{t('fileBrowser.overwriteExisting') || '覆盖已存在的文件'}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="extract-dialog__footer">
          <button className="extract-dialog__btn extract-dialog__btn--cancel" onClick={onClose}>
            {t('common.cancel') || '取消'}
          </button>
          <button 
            className="extract-dialog__btn extract-dialog__btn--confirm" 
            onClick={handleExtract}
            disabled={submitting}
          >
            {submitting ? (t('common.loading') || '处理中...') : (t('fileBrowser.startExtract') || '开始解压')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
