"""扫描日志目录，发现 conversation 子目录中的 events.jsonl。"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def scan_logs_dir(logs_dir: str) -> list[dict]:
    """扫描目录，返回 [{conversation_id: str, file_path: str}]。

    跳过权限不足的子目录，记录警告日志。
    """
    result = []
    logs_path = Path(logs_dir)

    if not logs_path.exists():
        return result

    try:
        entries = sorted(logs_path.iterdir())
    except OSError as e:
        logger.error("无法读取日志目录 %s: %s", logs_dir, e)
        return result

    for entry in entries:
        try:
            if entry.is_dir():
                events_file = entry / "events.jsonl"
                if events_file.exists():
                    result.append({
                        "conversation_id": entry.name,
                        "file_path": str(events_file),
                    })
        except OSError as e:
            logger.warning("跳过无法访问的目录 %s: %s", entry, e)
            continue

    return result
