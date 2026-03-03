import Dashboard from './components/Dashboard'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>AgentSmith</h1>
        <span className="app-subtitle">Agent 可观测性平台</span>
      </header>
      <Dashboard />
    </div>
  )
}

export default App
