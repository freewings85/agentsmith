"""增量读取 events.jsonl 文件：从指定 byte offset 开始读取新行。"""

import json
import os


def read_new_events(file_path: str, offset: int) -> tuple[list[dict], int]:
    """从指定 byte offset 开始读取新行。

    - 用 file.seek(offset) 跳到上次位置
    - 逐行 json.loads 解析，跳过无效行
    - offset 大于文件大小时重置为 0（文件被截断）
    - 返回 (events_list, new_offset)，new_offset = file.tell()
    """
    file_size = os.path.getsize(file_path)

    # 文件被截断：offset 超过文件大小，重置为 0
    if offset > file_size:
        offset = 0

    events: list[dict] = []
    with open(file_path, "r", encoding="utf-8") as f:
        f.seek(offset)
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError:
                continue
        new_offset = f.tell()

    return events, new_offset
