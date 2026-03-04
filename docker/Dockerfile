# ── Stage 1: 构建前端 ──────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /build
COPY agentsmith_web/package.json agentsmith_web/package-lock.json ./
RUN npm ci
COPY agentsmith_web/ ./
RUN npm run build

# ── Stage 2: Python 基础镜像（server / collector 共用）────
FROM python:3.12-slim AS python-base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 先装依赖（利用 Docker layer cache）
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 复制业务代码
COPY agentsmith_server/ ./agentsmith_server/
COPY agentsmith_collector/ ./agentsmith_collector/

# ── Stage 3a: Server ──────────────────────────────────────
FROM python-base AS server

COPY --from=frontend-builder /build/dist /app/static

ENV AGENTSMITH_STATIC_DIR=/app/static
ENV AGENTSMITH_DB_URL=mysql+pymysql://root:root@mysql:3306/agent_smith

EXPOSE 8120

CMD ["uv", "run", "uvicorn", "agentsmith_server.app:app", \
     "--host", "0.0.0.0", "--port", "8120"]

# ── Stage 3b: Collector ──────────────────────────────────
FROM python-base AS collector

STOPSIGNAL SIGTERM

CMD ["uv", "run", "python", "-m", "agentsmith_collector", \
     "--logs-dir", "/data/logs", \
     "--server-url", "http://server:8120"]
