"""扫描日志目录，发现 conversation 子目录中的 events.jsonl。"""

import os
from pathlib import Path


def scan_logs_dir(logs_dir: str) -> list[dict]:
    """扫描目录，返回 [{conversation_id: str, file_path: str}]。"""
    result = []
    logs_path = Path(logs_dir)

    if not logs_path.exists():
        return result

    for entry in sorted(logs_path.iterdir()):
        if entry.is_dir():
            events_file = entry / "events.jsonl"
            if events_file.exists():
                result.append({
                    "conversation_id": entry.name,
                    "file_path": str(events_file),
                })

    return result
