"""JsonLinesWriter 与 AgentSmithLogger。"""

import json
import logging
import os
from typing import Any, Optional

from .context import get_context
from .models import EventType, SpanEvent

_logger = logging.getLogger(__name__)


class JsonLinesWriter:
    """将 SpanEvent 写入 JSON Lines 文件。"""

    def __init__(self, base_dir: str):
        self.base_dir = base_dir

    def write(self, event: SpanEvent) -> None:
        """写入一个事件到对应 conversation 的 events.jsonl。

        文件 I/O 异常会被记录并重新抛出。
        """
        conv_dir = os.path.join(self.base_dir, event.conversation_id)
        try:
            os.makedirs(conv_dir, exist_ok=True)
            file_path = os.path.join(conv_dir, "events.jsonl")
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(event.to_json() + "\n")
        except OSError as e:
            _logger.error("写入事件失败 %s: %s", conv_dir, e)
            raise


# _START 类型事件，需要推入栈
_START_TYPES = {
    EventType.REQUEST_START,
    EventType.TOOL_START,
    EventType.LLM_START,
}

# _END 类型事件，需要从栈弹出
_END_TYPES = {
    EventType.REQUEST_END,
    EventType.TOOL_END,
    EventType.LLM_END,
}


class AgentSmithLogger:
    """主要的日志 API。所有 log_* 方法自动从 contextvars 获取 conversation_id/request_id。

    嵌套上下文：Logger 内部维护一个 span 栈（stack）。
    - 每次 log_xxx_start 时，将该事件的 span_id 推入栈。
    - 在栈顶 span_id 期间，记录的其他事件自动获得该 parent_span_id。
    - 对应的 log_xxx_end 弹出栈。
    """

    def __init__(self, base_dir: str):
        self.writer = JsonLinesWriter(base_dir=base_dir)
        self._span_stack: list[str] = []

    def _get_ids(self) -> tuple[str, str]:
        """从上下文获取 conversation_id 和 request_id。"""
        ctx = get_context()
        if ctx is None:
            raise RuntimeError("未设置上下文，请先调用 set_context()")
        return ctx.conversation_id, ctx.request_id

    def _current_parent(self) -> Optional[str]:
        """返回当前栈顶的 span_id 作为 parent_span_id。"""
        return self._span_stack[-1] if self._span_stack else None

    def _log(self, event_type: str, name: Optional[str] = None,
             data: Optional[dict[str, Any]] = None,
             duration_ms: Optional[int] = None) -> SpanEvent:
        """通用日志方法。"""
        conversation_id, request_id = self._get_ids()

        # REQUEST_START 是树根，清空栈确保 parent_span_id 为 None
        if event_type == EventType.REQUEST_START:
            self._span_stack.clear()

        parent_span_id = self._current_parent()

        event = SpanEvent(
            conversation_id=conversation_id,
            request_id=request_id,
            event_type=event_type,
            name=name,
            data=data,
            duration_ms=duration_ms,
            parent_span_id=parent_span_id,
        )

        # START 类型推入栈
        if event_type in _START_TYPES:
            self._span_stack.append(event.span_id)

        # END 类型弹出栈
        if event_type in _END_TYPES:
            if self._span_stack:
                self._span_stack.pop()

        self.writer.write(event)
        return event

    def log_request_start(self, user_query: str, **extra) -> None:
        data = {"user_query": user_query, **extra}
        self._log(EventType.REQUEST_START, data=data)

    def log_request_end(self, success: bool, error: Optional[str] = None, **extra) -> None:
        data: dict[str, Any] = {"success": success, **extra}
        if error is not None:
            data["error"] = error
        self._log(EventType.REQUEST_END, data=data)

    def log_tool_start(self, name: str, input_data: Optional[dict] = None) -> None:
        data = {"input": input_data} if input_data else {}
        self._log(EventType.TOOL_START, name=name, data=data)

    def log_tool_end(self, name: str, output_data: Optional[dict] = None,
                     duration_ms: Optional[int] = None) -> None:
        data = {"output": output_data} if output_data else {}
        self._log(EventType.TOOL_END, name=name, data=data, duration_ms=duration_ms)

    def log_llm_start(self, name: str, input_data: Optional[dict] = None) -> None:
        data = {"input": input_data} if input_data else {}
        self._log(EventType.LLM_START, name=name, data=data)

    def log_llm_end(self, name: str, output_data: Optional[dict] = None,
                    duration_ms: Optional[int] = None) -> None:
        data = {"output": output_data} if output_data else {}
        self._log(EventType.LLM_END, name=name, data=data, duration_ms=duration_ms)

    def log_http_request(self, name: str, data: Optional[dict] = None) -> None:
        self._log(EventType.HTTP_REQUEST, name=name, data=data)

    def log_http_response(self, name: str, data: Optional[dict] = None,
                          duration_ms: Optional[int] = None) -> None:
        self._log(EventType.HTTP_RESPONSE, name=name, data=data, duration_ms=duration_ms)

    def log_service_call(self, name: str, input_data: Optional[dict] = None) -> None:
        data = {"input": input_data} if input_data else {}
        self._log(EventType.SERVICE_CALL, name=name, data=data)

    def log_service_result(self, name: str, output_data: Optional[dict] = None,
                           duration_ms: Optional[int] = None) -> None:
        data = {"output": output_data} if output_data else {}
        self._log(EventType.SERVICE_RESULT, name=name, data=data, duration_ms=duration_ms)
