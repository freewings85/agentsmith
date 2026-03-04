import { useState, useEffect, useMemo } from 'react'

// ── 工具函数 ─────────────────────────────────────────────

function formatTime(timeStr) {
  if (!timeStr) return '-'
  try {
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return timeStr
    return date.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return timeStr }
}

function formatDuration(ms) {
  if (ms == null) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

function getSpanCategory(eventType) {
  if (!eventType) return 'request'
  if (eventType.startsWith('LLM')) return 'llm'
  if (eventType.startsWith('TOOL')) return 'tool'
  if (eventType.startsWith('HTTP')) return 'http'
  if (eventType.startsWith('SERVICE')) return 'service'
  return 'request'
}

function getDurationClass(ms) {
  if (ms == null) return ''
  if (ms > 5000) return 'duration-slow'
  if (ms > 1000) return 'duration-medium'
  return 'duration-fast'
}

function calcWallTime(startStr, endStr) {
  if (!startStr || !endStr) return null
  try {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime()
    return ms >= 0 ? ms : null
  } catch { return null }
}

/** 根据 parent_span_id 构建树形结构 */
function buildTree(spans) {
  const hasTree = spans.some(s => s.parent_span_id != null)
  if (!hasTree) {
    return spans.map(s => ({ ...s, children: [], depth: 0 }))
  }

  const byId = {}
  spans.forEach(s => {
    if (s.span_id) byId[s.span_id] = { ...s, children: [] }
  })

  const roots = []
  spans.forEach(s => {
    const node = s.span_id ? byId[s.span_id] : { ...s, children: [] }
    if (s.parent_span_id && byId[s.parent_span_id]) {
      byId[s.parent_span_id].children.push(node)
    } else {
      roots.push(node)
    }
  })

  function setDepth(nodes, depth) {
    nodes.forEach(n => { n.depth = depth; setDepth(n.children, depth + 1) })
  }
  setDepth(roots, 0)

  function flatten(nodes) {
    const result = []
    nodes.forEach(n => { result.push(n); result.push(...flatten(n.children)) })
    return result
  }
  return flatten(roots)
}

function extractInputOutput(span) {
  const data = span.data || {}
  const input = data.input || data.user_query || data.prompt || data.method || data.url
  const output = data.output || data.response || data.body || data.status_code || data.result
  return { input, output, raw: data }
}

/** 将对象/字符串格式化为可读文本，保留真换行 */
function formatDetail(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)
  // 对象：每个 key-value 分段显示，字符串值直接输出（保留换行）
  const parts = []
  for (const [key, val] of Object.entries(value)) {
    if (val == null) continue
    if (typeof val === 'string') {
      parts.push(`── ${key} ──\n${val}`)
    } else {
      parts.push(`── ${key} ──\n${JSON.stringify(val, null, 2)}`)
    }
  }
  return parts.join('\n\n')
}

// ── 类型过滤选项 ─────────────────────────────────────────

const SPAN_TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'llm', label: 'LLM' },
  { key: 'tool', label: 'Tool' },
  { key: 'http', label: 'HTTP' },
  { key: 'service', label: 'Service' },
  { key: 'request', label: 'Request' },
]

// ── 主面板组件 ───────────────────────────────────────────

function Dashboard() {
  // 数据
  const [conversations, setConversations] = useState([])
  const [requests, setRequests] = useState([])
  const [spans, setSpans] = useState([])
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingReq, setLoadingReq] = useState(false)
  const [loadingSpan, setLoadingSpan] = useState(false)

  // 选中状态
  const [selectedConv, setSelectedConv] = useState(null)
  const [selectedReq, setSelectedReq] = useState(null)
  const [selectedSpan, setSelectedSpan] = useState(null)

  // 过滤
  const [convSearch, setConvSearch] = useState('')
  const [reqSearch, setReqSearch] = useState('')
  const [spanTypeFilter, setSpanTypeFilter] = useState('all')

  // 加载会话列表（支持 ?conversation_id=xxx 自动选中）
  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        setConversations(data)
        setLoadingConv(false)
        const params = new URLSearchParams(window.location.search)
        const target = params.get('conversation_id')
        if (target && data.some(c => c.conversation_id === target)) {
          setSelectedConv(target)
          setConvSearch(target)
        }
      })
      .catch(() => setLoadingConv(false))
  }, [])

  // 加载请求列表
  useEffect(() => {
    if (!selectedConv) { setRequests([]); return }
    setLoadingReq(true)
    setSelectedReq(null)
    setSpans([])
    setSelectedSpan(null)
    fetch(`/api/conversations/${selectedConv}/requests`)
      .then(res => res.json())
      .then(data => { setRequests(data); setLoadingReq(false) })
      .catch(() => setLoadingReq(false))
  }, [selectedConv])

  // 加载 span 列表
  useEffect(() => {
    if (!selectedReq) { setSpans([]); return }
    setLoadingSpan(true)
    setSelectedSpan(null)
    fetch(`/api/requests/${selectedReq}/spans`)
      .then(res => res.json())
      .then(data => { setSpans(data); setLoadingSpan(false) })
      .catch(() => setLoadingSpan(false))
  }, [selectedReq])

  // 过滤后的会话
  const filteredConv = useMemo(() => {
    if (!convSearch.trim()) return conversations
    const term = convSearch.toLowerCase()
    return conversations.filter(c => c.conversation_id.toLowerCase().includes(term))
  }, [conversations, convSearch])

  // 过滤后的请求
  const filteredReq = useMemo(() => {
    if (!reqSearch.trim()) return requests
    const term = reqSearch.toLowerCase()
    return requests.filter(r =>
      r.request_id.toLowerCase().includes(term) ||
      (r.user_query && r.user_query.toLowerCase().includes(term))
    )
  }, [requests, reqSearch])

  // 过滤后的 span 树
  const treeNodes = useMemo(() => {
    const tree = buildTree(spans)
    if (spanTypeFilter === 'all') return tree
    return tree.filter(n => getSpanCategory(n.event_type) === spanTypeFilter)
  }, [spans, spanTypeFilter])

  // 详情数据
  const detail = selectedSpan ? extractInputOutput(selectedSpan) : null

  return (
    <div className="dashboard">
      {/* ── 左栏：会话列表 ── */}
      <div className="panel panel-conv">
        <div className="panel-header">
          <h3>会话</h3>
          <span className="panel-count">{conversations.length}</span>
        </div>
        <input
          className="panel-search"
          type="text"
          placeholder="搜索会话..."
          value={convSearch}
          onChange={e => setConvSearch(e.target.value)}
        />
        <div className="panel-list">
          {loadingConv ? <div className="panel-empty">加载中...</div> :
           filteredConv.length === 0 ? <div className="panel-empty">暂无数据</div> :
           filteredConv.map(conv => (
            <div
              key={conv.conversation_id}
              className={`panel-item${selectedConv === conv.conversation_id ? ' active' : ''}`}
              onClick={() => setSelectedConv(conv.conversation_id)}
            >
              <div className="item-title">{conv.conversation_id}</div>
              <div className="item-meta">
                <span className="meta-badge">{conv.request_count} 请求</span>
                <span>{formatTime(conv.last_seen)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 中栏：请求列表 ── */}
      <div className="panel panel-req">
        <div className="panel-header">
          <h3>请求</h3>
          {selectedConv && <span className="panel-count">{requests.length}</span>}
        </div>
        {selectedConv && (
          <input
            className="panel-search"
            type="text"
            placeholder="搜索请求..."
            value={reqSearch}
            onChange={e => setReqSearch(e.target.value)}
          />
        )}
        <div className="panel-list">
          {!selectedConv ? <div className="panel-empty">← 选择一个会话</div> :
           loadingReq ? <div className="panel-empty">加载中...</div> :
           filteredReq.length === 0 ? <div className="panel-empty">暂无请求</div> :
           filteredReq.map(req => {
            const wall = calcWallTime(req.started_at, req.ended_at)
            return (
              <div
                key={req.request_id}
                className={`panel-item${selectedReq === req.request_id ? ' active' : ''}`}
                onClick={() => setSelectedReq(req.request_id)}
              >
                <div className="item-title">
                  {req.user_query || req.request_id}
                  {req.success != null && (
                    <span className={`status-dot ${req.success ? 'success' : 'failed'}`} />
                  )}
                </div>
                <div className="item-meta">
                  <span className="item-id">{req.request_id.slice(0, 8)}</span>
                  {wall != null && (
                    <span className={getDurationClass(wall)}>{formatDuration(wall)}</span>
                  )}
                  <span>{formatTime(req.started_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 右栏：调用链 + 详情 ── */}
      <div className="panel panel-trace">
        <div className="panel-header">
          <h3>调用链</h3>
          {selectedReq && <span className="panel-count">{spans.length} spans</span>}
        </div>
        {selectedReq && (
          <div className="filter-bar">
            {SPAN_TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-btn${spanTypeFilter === f.key ? ' active' : ''}`}
                onClick={() => setSpanTypeFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="trace-content">
          {!selectedReq ? <div className="panel-empty">← 选择一个请求</div> :
           loadingSpan ? <div className="panel-empty">加载中...</div> :
           <>
            <div className="trace-tree-panel">
              {treeNodes.map((node, idx) => {
                const cat = getSpanCategory(node.event_type)
                const isSelected = selectedSpan && selectedSpan.span_id === node.span_id
                  && selectedSpan.event_type === node.event_type
                return (
                  <div
                    className={`tree-node span-item ${cat}${isSelected ? ' selected' : ''}`}
                    key={idx}
                    style={{ marginLeft: node.depth * 20 }}
                    onClick={() => setSelectedSpan(node)}
                  >
                    <span className={`span-type ${cat}`}>{node.event_type}</span>
                    {node.name && <span className="span-name">{node.name}</span>}
                    {node.duration_ms != null && (
                      <span className={`span-duration ${getDurationClass(node.duration_ms)}`}>
                        {node.duration_ms}ms
                      </span>
                    )}
                  </div>
                )
              })}
              {treeNodes.length === 0 && spans.length > 0 && (
                <div className="panel-empty">当前过滤条件无匹配</div>
              )}
              {spans.length === 0 && <div className="panel-empty">暂无 Span</div>}
            </div>
            {detail && selectedSpan && (
              <div className="trace-detail">
                <div className="detail-header">
                  <span className={`span-type ${getSpanCategory(selectedSpan.event_type)}`}>
                    {selectedSpan.event_type}
                  </span>
                  {selectedSpan.name && <span className="detail-name">{selectedSpan.name}</span>}
                </div>
                {selectedSpan.duration_ms != null && (
                  <div className="detail-meta">耗时: {selectedSpan.duration_ms}ms</div>
                )}
                {selectedSpan.timestamp && (
                  <div className="detail-meta">时间: {formatTime(selectedSpan.timestamp)}</div>
                )}
                {detail.input != null && (
                  <div className="detail-section">
                    <h4>Input</h4>
                    <pre className="detail-data">{formatDetail(detail.input)}</pre>
                  </div>
                )}
                {detail.output != null && (
                  <div className="detail-section">
                    <h4>Output</h4>
                    <pre className="detail-data">{formatDetail(detail.output)}</pre>
                  </div>
                )}
                {!detail.input && !detail.output && detail.raw && Object.keys(detail.raw).length > 0 && (
                  <div className="detail-section">
                    <h4>Data</h4>
                    <pre className="detail-data">{JSON.stringify(detail.raw, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
           </>
          }
        </div>
      </div>
    </div>
  )
}

export default Dashboard
