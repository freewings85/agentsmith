"""POST /api/spans — 接收 SpanEvent 列表写入 MySQL。"""

from fastapi import APIRouter, Request

from ..schemas import SpanInput
from ..database import insert_spans

router = APIRouter()


@router.post("/api/spans")
def ingest_spans(spans: list[SpanInput], request: Request):
    """接收 SpanEvent 列表并写入数据库。"""
    engine = request.app.state.engine
    spans_data = [s.model_dump() for s in spans]
    insert_spans(engine, spans_data)
    return {"status": "ok", "inserted": len(spans_data)}
