#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 确保 agent_smith 数据库存在
echo "检查 MySQL 数据库..."
mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS agent_smith;" 2>/dev/null \
  && echo "数据库 agent_smith 就绪" \
  || echo "警告: 无法连接 MySQL，请确保 MySQL 已启动"

# 构建并启动
echo "启动 Docker 服务..."
cd "$SCRIPT_DIR/docker"
docker compose up --build -d

echo ""
docker compose ps
echo ""
echo "AgentSmith 已启动: http://127.0.0.1:18900"
