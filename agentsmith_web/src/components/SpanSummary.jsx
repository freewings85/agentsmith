/**
 * Span 统计摘要组件
 * 展示一个请求中各类型 span 的数量分布、总耗时等统计信息
 */

const TYPE_CONFIG = {
  llm: { label: 'LLM 调用', color: '#4caf50' },
  tool: { label: '工具调用', color: '#2196f3' },
  http: { label: 'HTTP 请求', color: '#ff9800' },
  service: { label: '服务调用', color: '#9c27b0' },
  request: { label: '请求', color: '#f44336' },
}

function getCategory(eventType) {
  if (!eventType) return 'request'
  if (eventType.startsWith('LLM')) return 'llm'
  if (eventType.startsWith('TOOL')) return 'tool'
  if (eventType.startsWith('HTTP')) return 'http'
  if (eventType.startsWith('SERVICE')) return 'service'
  return 'request'
}

function formatDuration(ms) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

function SpanSummary({ spans }) {
  if (!spans || spans.length === 0) {
    return null
  }

  // 统计各类型数量
  const typeCounts = {}
  let totalDuration = 0
  let maxDuration = 0
  let spanWithMaxDuration = null

  spans.forEach(span => {
    const cat = getCategory(span.event_type)
    typeCounts[cat] = (typeCounts[cat] || 0) + 1

    if (span.duration_ms != null && span.duration_ms > 0) {
      totalDuration += span.duration_ms
      if (span.duration_ms > maxDuration) {
        maxDuration = span.duration_ms
        spanWithMaxDuration = span
      }
    }
  })

  // 计算请求状态
  const requestEnd = spans.find(s => s.event_type === 'REQUEST_END')
  const requestSuccess = requestEnd?.data?.success

  // 计算时间范围
  const timestamps = spans
    .filter(s => s.timestamp)
    .map(s => new Date(s.timestamp).getTime())
    .filter(t => !isNaN(t))
  const startTime = timestamps.length > 0 ? Math.min(...timestamps) : null
  const endTime = timestamps.length > 0 ? Math.max(...timestamps) : null
  const wallTime = startTime && endTime ? endTime - startTime : null

  return (
    <div className="span-summary">
      <div className="summary-header">
        <h3>请求摘要</h3>
        {requestSuccess != null && (
          <span className={`summary-status ${requestSuccess ? 'success' : 'failed'}`}>
            {requestSuccess ? '成功' : '失败'}
          </span>
        )}
      </div>

      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">Span 总数</span>
          <span className="stat-value">{spans.length}</span>
        </div>
        {wallTime != null && (
          <div className="stat-item">
            <span className="stat-label">总耗时</span>
            <span className="stat-value">{formatDuration(wallTime)}</span>
          </div>
        )}
        {spanWithMaxDuration && (
          <div className="stat-item">
            <span className="stat-label">最慢操作</span>
            <span className="stat-value" title={spanWithMaxDuration.name || spanWithMaxDuration.event_type}>
              {formatDuration(maxDuration)}
            </span>
          </div>
        )}
      </div>

      <div className="summary-type-distribution">
        <h4>类型分布</h4>
        <div className="type-bars">
          {Object.entries(typeCounts).map(([type, count]) => {
            const config = TYPE_CONFIG[type] || { label: type, color: '#999' }
            const pct = Math.round((count / spans.length) * 100)
            return (
              <div className="type-bar-row" key={type}>
                <span className="type-bar-label" style={{ color: config.color }}>
                  {config.label}
                </span>
                <div className="type-bar-track">
                  <div
                    className="type-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: config.color }}
                  />
                </div>
                <span className="type-bar-count">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SpanSummary
