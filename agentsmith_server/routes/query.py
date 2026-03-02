"""查询接口：conversations, requests, spans。"""

from fastapi import APIRouter, Request

from ..database import get_conversations, get_requests, get_spans

router = APIRouter()


@router.get("/api/conversations")
def list_conversations(request: Request):
    """返回会话列表。"""
    engine = request.app.state.engine
    return get_conversations(engine)


@router.get("/api/conversations/{conversation_id}/requests")
def list_requests(conversation_id: str, request: Request):
    """返回指定会话的请求列表。"""
    engine = request.app.state.engine
    return get_requests(engine, conversation_id)


@router.get("/api/requests/{request_id}/spans")
def list_spans(request_id: str, request: Request):
    """返回指定请求的所有 span。"""
    engine = request.app.state.engine
    return get_spans(engine, request_id)
