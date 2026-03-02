import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

function RequestList() {
  const { id } = useParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/conversations/${id}/requests`)
      .then(res => res.json())
      .then(data => {
        setRequests(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">会话列表</Link> &gt; {id}
      </div>
      <h2 style={{ marginBottom: 16 }}>请求列表</h2>
      <div className="card-list">
        {requests.map(req => (
          <div className="card" key={req.request_id}>
            <Link to={`/requests/${req.request_id}`}>
              <div className="card-title">{req.request_id}</div>
              <div className="card-meta">
                {req.user_query && <span>查询: {req.user_query} | </span>}
                {req.success !== null && <span>状态: {req.success ? '成功' : '失败'} | </span>}
                开始: {req.started_at}
              </div>
            </Link>
          </div>
        ))}
        {requests.length === 0 && <div className="loading">暂无请求数据</div>}
      </div>
    </div>
  )
}

export default RequestList
