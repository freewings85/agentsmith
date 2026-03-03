import { Link, useLocation } from 'react-router-dom'

/**
 * 通用错误页面组件
 * 用于 404 和其他路由错误的友好展示
 */
function ErrorPage({ title, message, statusCode }) {
  const location = useLocation()
  const code = statusCode || 404
  const displayTitle = title || '页面未找到'
  const displayMessage = message || `路径 "${location.pathname}" 不存在，请检查链接是否正确。`

  return (
    <div className="error-page">
      <div className="error-status-code">{code}</div>
      <h2 className="error-title">{displayTitle}</h2>
      <p className="error-message">{displayMessage}</p>
      <div className="error-suggestions">
        <p>您可以尝试：</p>
        <ul>
          <li>检查 URL 是否拼写正确</li>
          <li>返回首页查看所有会话</li>
          <li>确认后端服务是否正常运行</li>
        </ul>
      </div>
      <Link to="/" className="error-home-link">
        返回首页
      </Link>
    </div>
  )
}

export default ErrorPage
