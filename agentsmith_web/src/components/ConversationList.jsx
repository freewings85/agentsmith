import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function ConversationList() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        setConversations(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>会话列表</h2>
      <div className="card-list">
        {conversations.map(conv => (
          <div className="card" key={conv.conversation_id}>
            <Link to={`/conversations/${conv.conversation_id}`}>
              <div className="card-title">{conv.conversation_id}</div>
              <div className="card-meta">
                请求数: {conv.request_count} |
                最后活跃: {conv.last_seen}
              </div>
            </Link>
          </div>
        ))}
        {conversations.length === 0 && <div className="loading">暂无会话数据</div>}
      </div>
    </div>
  )
}

export default ConversationList
