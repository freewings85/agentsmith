import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ConversationList from './components/ConversationList'
import RequestList from './components/RequestList'
import SpanDetail from './components/SpanDetail'
import ErrorPage from './components/ErrorPage'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <h1><a href="/">AgentSmith</a></h1>
          <span className="app-subtitle">Agent 可观测性平台</span>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<ConversationList />} />
            <Route path="/conversations/:id" element={<RequestList />} />
            <Route path="/requests/:id" element={<SpanDetail />} />
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
