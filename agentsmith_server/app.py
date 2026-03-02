"""FastAPI 应用工厂。"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine

from .database import Base, migrate_spans_table
from .routes.ingest import router as ingest_router
from .routes.query import router as query_router


def create_app(engine=None) -> FastAPI:
    """创建 FastAPI 应用。"""
    app = FastAPI(title="AgentSmith Server")

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 数据库
    if engine is None:
        db_url = os.environ.get(
            "AGENTSMITH_DB_URL",
            "mysql+pymysql://root:root@127.0.0.1:3306/agent_smith",
        )
        engine = create_engine(db_url)

    Base.metadata.create_all(engine)
    migrate_spans_table(engine)
    app.state.engine = engine

    # 路由
    app.include_router(ingest_router)
    app.include_router(query_router)

    # 静态文件托管
    static_dir = os.environ.get("AGENTSMITH_STATIC_DIR")
    if static_dir and os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


# uvicorn 入口
app = create_app()
