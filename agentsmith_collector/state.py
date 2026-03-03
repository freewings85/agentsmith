"""增量读取状态管理：追踪每个 events.jsonl 文件的已处理 byte offset。"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class CollectorState:
    """管理每个 events.jsonl 文件的已处理 byte offset。

    状态持久化到 {state_dir}/.collector_state.json。
    JSON 格式：{"files": {"/abs/path/events.jsonl": {"offset": 1234, "last_pushed": "iso_timestamp"}}}
    """

    def __init__(self, state_dir: str | Path):
        """加载已有状态文件（如果存在）。"""
        self._state_dir = Path(state_dir)
        self._state_file = self._state_dir / ".collector_state.json"
        self._files: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        """从状态文件加载已有状态。"""
        if self._state_file.exists():
            try:
                data = json.loads(self._state_file.read_text(encoding="utf-8"))
                self._files = data.get("files", {})
            except (json.JSONDecodeError, OSError):
                self._files = {}

    def get_offset(self, file_path: str) -> int:
        """获取文件的已处理 offset，未跟踪的文件返回 0。"""
        info = self._files.get(file_path)
        if info is None:
            return 0
        return info.get("offset", 0)

    def set_offset(self, file_path: str, offset: int) -> None:
        """更新文件的 offset 和 last_pushed 时间戳。"""
        self._files[file_path] = {
            "offset": offset,
            "last_pushed": datetime.now(timezone.utc).isoformat(),
        }

    def save(self) -> None:
        """持久化状态到 .collector_state.json。"""
        self._state_dir.mkdir(parents=True, exist_ok=True)
        data = {"files": self._files}
        self._state_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
