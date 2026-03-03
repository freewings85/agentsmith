import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

/**
 * 格式化时间戳为更可读的形式
 */
function formatTime(timeStr) {
  if (!timeStr) return '-'
  try {
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return timeStr
    const now = new Date()
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    if (diffHour < 24) return `${diffHour} 小时前`
    if (diffDay < 7) return `${diffDay} 天前`

    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return timeStr
  }
}

function ConversationList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setConversations(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return conversations
    const term = searchTerm.toLowerCase()
    return conversations.filter(conv =>
      conv.conversation_id.toLowerCase().includes(term)
    )
  }, [conversations, searchTerm])

  if (loading) return <div className="loading">加载中...</div>

  if (error) {
    return (
      <div className="error-banner">
        <span>加载失败: {error}</span>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>会话列表</h2>
        <span className="page-count">{conversations.length} 个会话</span>
      </div>

      {conversations.length > 3 && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索会话 ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      <div className="card-list">
        {filtered.map(conv => (
          <div className="card" key={conv.conversation_id}>
            <Link to={`/conversations/${conv.conversation_id}`}>
              <div className="card-title">{conv.conversation_id}</div>
              <div className="card-meta">
                <span className="meta-badge">
                  {conv.request_count} 个请求
                </span>
                <span className="meta-separator">|</span>
                <span>最后活跃: {formatTime(conv.last_seen)}</span>
              </div>
            </Link>
          </div>
        ))}
        {filtered.length === 0 && conversations.length > 0 && (
          <div className="loading">没有匹配的会话</div>
        )}
        {conversations.length === 0 && <div className="loading">暂无会话数据</div>}
      </div>
    </div>
  )
}

export default ConversationList
