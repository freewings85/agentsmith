"""逐行解析 JSON Lines 文件。"""

import json


def parse_events_file(file_path: str) -> list[dict]:
    """逐行解析 JSON Lines，跳过无效行，返回事件 dict 列表。"""
    events = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError:
                continue
    return events
