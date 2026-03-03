import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import SpanSummary from './SpanSummary'

function getSpanCategory(eventType) {
  if (eventType.startsWith('LLM')) return 'llm'
  if (eventType.startsWith('TOOL')) return 'tool'
  if (eventType.startsWith('HTTP')) return 'http'
  if (eventType.startsWith('SERVICE')) return 'service'
  return 'request'
}

/** 根据耗时返回速度等级 CSS 类名 */
function getDurationClass(ms) {
  if (ms == null) return ''
  if (ms > 5000) return 'duration-slow'
  if (ms > 1000) return 'duration-medium'
  return 'duration-fast'
}

/** 根据 parent_span_id 构建树形结构，无 parent_span_id 时退化为平铺列表 */
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

  // 计算深度
  function setDepth(nodes, depth) {
    nodes.forEach(n => {
      n.depth = depth
      setDepth(n.children, depth + 1)
    })
  }
  setDepth(roots, 0)

  // 展平为有序列表（前序遍历）
  function flatten(nodes) {
    const result = []
    nodes.forEach(n => {
      result.push(n)
      result.push(...flatten(n.children))
    })
    return result
  }
  return flatten(roots)
}

/** 从 span.data 中提取 Input 和 Output */
function extractInputOutput(span) {
  const data = span.data || {}
  const input = data.input || data.user_query || data.prompt || data.method || data.url
  const output = data.output || data.response || data.body || data.status_code || data.result
  return { input, output, raw: data }
}

function SpanDetail() {
  const { id } = useParams()
  const [spans, setSpans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`/api/requests/${id}/spans`)
      .then(res => res.json())
      .then(data => {
        setSpans(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading">加载中...</div>

  const conversationId = spans.length > 0 ? spans[0].conversation_id : ''
  const treeNodes = buildTree(spans)
  const { input, output, raw } = selected ? extractInputOutput(selected) : {}

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">会话列表</Link>
        {conversationId && (
          <> &gt; <Link to={`/conversations/${conversationId}`}>{conversationId}</Link></>
        )}
        &gt; {id}
      </div>
      <h2 style={{ marginBottom: 16 }}>调用链详情</h2>
      <SpanSummary spans={spans} />
      <div className="trace-layout">
        <div className="trace-tree">
          {treeNodes.map((node, idx) => {
            const cat = getSpanCategory(node.event_type)
            const isSelected = selected && selected.span_id === node.span_id && selected.event_type === node.event_type
            return (
              <div
                className={`tree-node span-item ${cat}${isSelected ? ' selected' : ''}`}
                key={idx}
                style={{ marginLeft: node.depth * 24 }}
                onClick={() => setSelected(node)}
              >
                <div>
                  <span className={`span-type ${cat}`}>{node.event_type}</span>
                  {node.name && <span className="span-name">{node.name}</span>}
                  {node.duration_ms != null && (
                    <span className={`span-duration ${getDurationClass(node.duration_ms)}`}>{node.duration_ms}ms</span>
                  )}
                </div>
              </div>
            )
          })}
          {spans.length === 0 && <div className="loading">暂无 Span 数据</div>}
        </div>
        {selected && (
          <div className="trace-detail">
            <h3>{selected.event_type}{selected.name ? ` - ${selected.name}` : ''}</h3>
            {selected.duration_ms != null && (
              <div className="detail-duration">耗时: {selected.duration_ms}ms</div>
            )}
            {input != null && (
              <div className="detail-section">
                <h4>Input</h4>
                <pre className="detail-data">
                  {typeof input === 'object' ? JSON.stringify(input, null, 2) : String(input)}
                </pre>
              </div>
            )}
            {output != null && (
              <div className="detail-section">
                <h4>Output</h4>
                <pre className="detail-data">
                  {typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}
                </pre>
              </div>
            )}
            {!input && !output && raw && Object.keys(raw).length > 0 && (
              <div className="detail-section">
                <h4>Data</h4>
                <pre className="detail-data">{JSON.stringify(raw, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SpanDetail
