"""SQLAlchemy 表定义 + CRUD 函数。"""

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Text, JSON,
    Index, create_engine, text,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(255), unique=True, nullable=False)
    first_seen = Column(DateTime, nullable=False)
    last_seen = Column(DateTime, nullable=False)
    request_count = Column(Integer, default=0)


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(255), nullable=False)
    request_id = Column(String(255), nullable=False)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    success = Column(Boolean)
    user_query = Column(Text)

    __table_args__ = (
        Index("idx_conversation", "conversation_id"),
    )


class Span(Base):
    __tablename__ = "spans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(255), nullable=False)
    request_id = Column(String(255), nullable=False)
    event_type = Column(String(50), nullable=False)
    name = Column(String(500))
    timestamp = Column(DateTime, nullable=False)
    duration_ms = Column(Integer)
    data = Column(JSON)
    span_id = Column(String(255), nullable=True)
    parent_span_id = Column(String(255), nullable=True)

    __table_args__ = (
        Index("idx_request", "request_id"),
        Index("idx_span_conversation", "conversation_id"),
    )


def migrate_spans_table(engine) -> None:
    """为已有的 spans 表添加 span_id 和 parent_span_id 列（如果不存在）。"""
    with engine.connect() as conn:
        cols = conn.execute(text("SHOW COLUMNS FROM spans")).fetchall()
        col_names = {c[0] for c in cols}
        if "span_id" not in col_names:
            conn.execute(text("ALTER TABLE spans ADD COLUMN span_id VARCHAR(255) NULL"))
        if "parent_span_id" not in col_names:
            conn.execute(text("ALTER TABLE spans ADD COLUMN parent_span_id VARCHAR(255) NULL"))
        conn.commit()


def _parse_timestamp(ts_str: str) -> datetime:
    """解析时间戳字符串。"""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(ts_str)


def insert_spans(engine, spans_data: list[dict]) -> None:
    """批量写入 spans，同时更新 conversations 和 requests 表。"""
    if not spans_data:
        return

    with engine.begin() as conn:
        for span in spans_data:
            ts = _parse_timestamp(span["timestamp"])
            conv_id = span["conversation_id"]
            req_id = span["request_id"]
            event_type = span["event_type"]
            data = span.get("data") or {}

            # 写入 span
            conn.execute(
                text(
                    "INSERT INTO spans (conversation_id, request_id, event_type, name, timestamp, duration_ms, data, span_id, parent_span_id) "
                    "VALUES (:conv_id, :req_id, :event_type, :name, :ts, :duration_ms, :data, :span_id, :parent_span_id)"
                ),
                {
                    "conv_id": conv_id,
                    "req_id": req_id,
                    "event_type": event_type,
                    "name": span.get("name"),
                    "ts": ts,
                    "duration_ms": span.get("duration_ms"),
                    "data": json.dumps(data, ensure_ascii=False),
                    "span_id": span.get("span_id"),
                    "parent_span_id": span.get("parent_span_id"),
                },
            )

            # 更新 conversations 表（upsert）
            existing = conn.execute(
                text("SELECT id, first_seen FROM conversations WHERE conversation_id = :cid"),
                {"cid": conv_id},
            ).fetchone()

            if existing is None:
                conn.execute(
                    text(
                        "INSERT INTO conversations (conversation_id, first_seen, last_seen, request_count) "
                        "VALUES (:cid, :ts, :ts, 0)"
                    ),
                    {"cid": conv_id, "ts": ts},
                )
            else:
                conn.execute(
                    text("UPDATE conversations SET last_seen = :ts WHERE conversation_id = :cid AND last_seen < :ts"),
                    {"cid": conv_id, "ts": ts},
                )

            # 更新 requests 表
            existing_req = conn.execute(
                text("SELECT id FROM requests WHERE conversation_id = :cid AND request_id = :rid"),
                {"cid": conv_id, "rid": req_id},
            ).fetchone()

            if existing_req is None:
                started_at = ts if event_type == "REQUEST_START" else None
                ended_at = ts if event_type == "REQUEST_END" else None
                success = data.get("success") if event_type == "REQUEST_END" else None
                user_query = data.get("user_query") if event_type == "REQUEST_START" else None

                conn.execute(
                    text(
                        "INSERT INTO requests (conversation_id, request_id, started_at, ended_at, success, user_query) "
                        "VALUES (:cid, :rid, :started_at, :ended_at, :success, :user_query)"
                    ),
                    {
                        "cid": conv_id, "rid": req_id,
                        "started_at": started_at, "ended_at": ended_at,
                        "success": success, "user_query": user_query,
                    },
                )

                # 更新 conversation 的 request_count
                conn.execute(
                    text("UPDATE conversations SET request_count = request_count + 1 WHERE conversation_id = :cid"),
                    {"cid": conv_id},
                )
            else:
                # 更新已有 request
                if event_type == "REQUEST_START":
                    conn.execute(
                        text("UPDATE requests SET started_at = :ts, user_query = :uq WHERE conversation_id = :cid AND request_id = :rid"),
                        {"ts": ts, "uq": data.get("user_query"), "cid": conv_id, "rid": req_id},
                    )
                elif event_type == "REQUEST_END":
                    conn.execute(
                        text("UPDATE requests SET ended_at = :ts, success = :success WHERE conversation_id = :cid AND request_id = :rid"),
                        {"ts": ts, "success": data.get("success"), "cid": conv_id, "rid": req_id},
                    )


def get_conversations(engine) -> list[dict]:
    """查询所有会话。"""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT conversation_id, first_seen, last_seen, request_count FROM conversations ORDER BY last_seen DESC")
        ).fetchall()
        return [
            {
                "conversation_id": r[0],
                "first_seen": r[1].isoformat() if r[1] else None,
                "last_seen": r[2].isoformat() if r[2] else None,
                "request_count": r[3],
            }
            for r in rows
        ]


def get_requests(engine, conversation_id: str) -> list[dict]:
    """查询指定会话的请求列表。"""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT request_id, started_at, ended_at, success, user_query FROM requests WHERE conversation_id = :cid ORDER BY started_at"),
            {"cid": conversation_id},
        ).fetchall()
        return [
            {
                "request_id": r[0],
                "started_at": r[1].isoformat() if r[1] else None,
                "ended_at": r[2].isoformat() if r[2] else None,
                "success": r[3],
                "user_query": r[4],
            }
            for r in rows
        ]


def get_spans(engine, request_id: str) -> list[dict]:
    """查询指定请求的所有 span（按 timestamp 排序）。"""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT conversation_id, request_id, event_type, name, timestamp, duration_ms, data, span_id, parent_span_id FROM spans WHERE request_id = :rid ORDER BY timestamp"),
            {"rid": request_id},
        ).fetchall()
        return [
            {
                "conversation_id": r[0],
                "request_id": r[1],
                "event_type": r[2],
                "name": r[3],
                "timestamp": r[4].isoformat() if r[4] else None,
                "duration_ms": r[5],
                "data": json.loads(r[6]) if isinstance(r[6], str) else (r[6] or {}),
                "span_id": r[7],
                "parent_span_id": r[8],
            }
            for r in rows
        ]
