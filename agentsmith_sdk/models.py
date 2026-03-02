"""SpanEvent 数据模型与 EventType 常量。"""

import json
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4


class EventType:
    """可观测事件类型常量。"""
    REQUEST_START = "REQUEST_START"
    REQUEST_END = "REQUEST_END"
    LLM_START = "LLM_START"
    LLM_END = "LLM_END"
    TOOL_START = "TOOL_START"
    TOOL_END = "TOOL_END"
    HTTP_REQUEST = "HTTP_REQUEST"
    HTTP_RESPONSE = "HTTP_RESPONSE"
    SERVICE_CALL = "SERVICE_CALL"
    SERVICE_RESULT = "SERVICE_RESULT"


class SpanEvent:
    """一个可观测事件。"""

    def __init__(
        self,
        conversation_id: str,
        request_id: str,
        event_type: str,
        name: Optional[str] = None,
        data: Optional[dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        timestamp: Optional[str] = None,
        span_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
    ):
        self.timestamp = timestamp or datetime.utcnow().isoformat()
        self.conversation_id = conversation_id
        self.request_id = request_id
        self.event_type = event_type
        self.name = name
        self.data = data or {}
        self.duration_ms = duration_ms
        self.span_id = span_id or uuid4().hex[:12]
        self.parent_span_id = parent_span_id

    def to_dict(self) -> dict:
        """转换为字典。"""
        return {
            "timestamp": self.timestamp,
            "conversation_id": self.conversation_id,
            "request_id": self.request_id,
            "event_type": self.event_type,
            "name": self.name,
            "data": self.data,
            "duration_ms": self.duration_ms,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
        }

    def to_json(self) -> str:
        """转换为 JSON 字符串。"""
        return json.dumps(self.to_dict(), ensure_ascii=False)
