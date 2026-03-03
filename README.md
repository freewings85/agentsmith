# AgentSmith

Agent 可观测性平台 — 采集、存储、展示 AI Agent 的运行日志。

## 架构

```
你的 Agent 项目
    ↓ (SDK 写 JSON Lines 日志)
agentsmith_collector (扫描 → 解析 → 推送)
    ↓ (HTTP POST /api/spans)
agentsmith_server (FastAPI + MySQL 存储)
    ↓ (HTTP GET /api/*)
agentsmith_web (React 前端展示)
```

## 组件

| 组件 | 说明 |
|------|------|
| `agentsmith_sdk` | Python SDK，嵌入你的 Agent 项目，记录 Span 事件（REQUEST/LLM/TOOL/HTTP） |
| `agentsmith_collector` | 日志采集器，扫描 JSON Lines 文件，解析并推送到 Server |
| `agentsmith_server` | 后端服务，接收数据并存储到 MySQL，提供查询 API |
| `agentsmith_web` | 前端 UI，树形展示 Trace 链路，支持按类型筛选和详情查看 |

## 快速开始

### 1. 安装依赖

```bash
uv sync
```

### 2. 启动 Server

需要 MySQL，配置环境变量 `DATABASE_URL`（默认 `mysql+pymysql://root:@localhost/agentsmith`）。

```bash
uv run uvicorn agentsmith_server.app:app --host 0.0.0.0 --port 18900
```

### 3. 启动 Web

```bash
cd agentsmith_web
npm install
npm run dev
```

访问 http://localhost:3100

### 4. 在你的项目中接入 SDK

```python
from agentsmith_sdk import AgentSmithLogger, set_context

logger = AgentSmithLogger(base_dir=".tmp/agent_logs")
set_context(conversation_id="conv-1", request_id="req-1")

# 记录事件（自动维护 span_id/parent_span_id 树形结构）
logger.log_request_start(user_query="hello")
logger.log_llm_start(name="GPT调用", input_data={"prompt": "..."})
logger.log_llm_end(name="GPT调用", output_data={"response": "..."}, duration_ms=1200)
logger.log_request_end(success=True)
```

### 5. 运行 Collector 采集日志

```python
from agentsmith_collector import scanner, parser, pusher

files = scanner.scan_logs_dir(".tmp/agent_logs")
for f in files:
    events = parser.parse_events_file(f["file_path"])
    pusher.push_spans("http://localhost:18900", events)
```

## 由 auto-developing 框架生成

本项目由 [auto-developing](https://github.com/freewings85/auto-developing) 自动化开发框架生成，训练过程见 [auto-developing-agentsmith](https://github.com/freewings85/auto-developing-agentsmith)。
