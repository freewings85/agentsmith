import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

/**
 * 格式化时间戳为简短形式
 */
function formatTimestamp(timeStr) {
  if (!timeStr) return '-'
  try {
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return timeStr
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return timeStr
  }
}

/**
 * 计算两个时间戳之间的持续时间
 */
function calcDuration(startStr, endStr) {
  if (!startStr || !endStr) return null
  try {
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()
    if (isNaN(start) || isNaN(end)) return null
    const ms = end - start
    if (ms < 0) return null
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  } catch {
    return null
  }
}

/** 根据耗时返回速度等级 CSS 类名 */
function getDurationClass(durationStr) {
  if (!durationStr) return ''
  const ms = parseFloat(durationStr)
  if (isNaN(ms)) return ''
  if (durationStr.endsWith('min')) return 'duration-slow'
  if (durationStr.endsWith('s') && !durationStr.endsWith('ms') && ms > 5) return 'duration-slow'
  if (durationStr.endsWith('s') && !durationStr.endsWith('ms') && ms > 1) return 'duration-medium'
  if (durationStr.endsWith('ms') && ms > 5000) return 'duration-slow'
  if (durationStr.endsWith('ms') && ms > 1000) return 'duration-medium'
  return 'duration-fast'
}

function RequestList() {
  const { id } = useParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetch(`/api/conversations/${id}/requests`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setRequests(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return requests
    const term = searchTerm.toLowerCase()
    return requests.filter(req =>
      req.request_id.toLowerCase().includes(term) ||
      (req.user_query && req.user_query.toLowerCase().includes(term))
    )
  }, [requests, searchTerm])

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
      <div className="breadcrumb">
        <Link to="/">会话列表</Link> &gt; {id}
      </div>

      <div className="page-header">
        <h2>请求列表</h2>
        <span className="page-count">{requests.length} 个请求</span>
      </div>

      {requests.length > 3 && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索请求 ID 或查询内容..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      <div className="card-list">
        {filtered.map(req => {
          const duration = calcDuration(req.started_at, req.ended_at)
          return (
            <div className="card" key={req.request_id}>
              <Link to={`/requests/${req.request_id}`}>
                <div className="card-title">
                  {req.request_id}
                  {req.success != null && (
                    <span className={`status-dot ${req.success ? 'success' : 'failed'}`} />
                  )}
                </div>
                <div className="card-meta">
                  {req.user_query && (
                    <span className="meta-query">{req.user_query}</span>
                  )}
                </div>
                <div className="card-meta">
                  {req.success !== null && (
                    <span>状态: {req.success ? '成功' : '失败'}</span>
                  )}
                  {duration && (
                    <>
                      <span className="meta-separator">|</span>
                      <span className={getDurationClass(duration)}>耗时: {duration}</span>
                    </>
                  )}
                  <span className="meta-separator">|</span>
                  <span>开始: {formatTimestamp(req.started_at)}</span>
                </div>
              </Link>
            </div>
          )
        })}
        {filtered.length === 0 && requests.length > 0 && (
          <div className="loading">没有匹配的请求</div>
        )}
        {requests.length === 0 && <div className="loading">暂无请求数据</div>}
      </div>
    </div>
  )
}

export default RequestList
