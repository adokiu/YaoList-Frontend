import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import { AdminPageHeader } from '../../components/manage/AdminPageHeader'
import '../../styles/components/about.scss'

export default function About() {
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReadme = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/chuyao233/yaolist/main/README.md'
      )
      if (!response.ok) {
        throw new Error('获取README失败')
      }
      const text = await response.text()
      setMarkdown(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReadme()
  }, [])

  return (
    <div className="admin-page about">
      <AdminPageHeader
        title="关于 YaoList"
        actions={
          <>
            <button
              type="button"
              className="about__btn"
              onClick={fetchReadme}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              刷新
            </button>
            <a
              href="https://github.com/chuyao233/yaolist"
              target="_blank"
              rel="noopener noreferrer"
              className="about__btn"
            >
              <ExternalLink size={16} />
              GitHub
            </a>
          </>
        }
      />

      <div className="about__content">
        {loading ? (
          <div className="about__loading">
            <Loader2 size={32} className="spinning" />
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="about__error">
            <p>{error}</p>
            <button onClick={fetchReadme}>重试</button>
          </div>
        ) : (
          <div className="about__markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
