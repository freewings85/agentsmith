"""Pydantic 请求/响应模型。"""

from typing import Any, Optional

from pydantic import BaseModel


class SpanInput(BaseModel):
    """POST /api/spans 请求体中的单个 span。"""
    timestamp: str
    conversation_id: str
    request_id: str
    event_type: str
    name: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    duration_ms: Optional[int] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
