"""基于 contextvars 的上下文管理。"""

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional


@dataclass
class Context:
    """当前请求上下文。"""
    conversation_id: Optional[str] = None
    request_id: Optional[str] = None


_context_var: ContextVar[Optional[Context]] = ContextVar("agentsmith_context", default=None)


def set_context(conversation_id: str, request_id: str) -> None:
    """设置当前上下文。"""
    _context_var.set(Context(conversation_id=conversation_id, request_id=request_id))


def get_context() -> Optional[Context]:
    """获取当前上下文。"""
    return _context_var.get()


def clear_context() -> None:
    """清除当前上下文。"""
    _context_var.set(None)
