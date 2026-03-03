"""Collector Daemon：持续监听日志目录，自动推送新事件到 Server。"""

import logging
import os
import time
from datetime import datetime

from agentsmith_collector.incremental import read_new_events
from agentsmith_collector.pusher import push_spans
from agentsmith_collector.scanner import scan_logs_dir
from agentsmith_collector.state import CollectorState

logger = logging.getLogger(__name__)


class CollectorDaemon:
    """持续监听日志目录，自动推送新事件到 Server。

    纯轮询实现，不依赖 watchdog。
    """

    def __init__(
        self,
        logs_dir: str,
        server_url: str,
        poll_interval: float = 5,
        rotate_threshold_bytes: int = 5 * 1024 * 1024,
    ):
        """初始化。CollectorState 自动从 logs_dir 加载。"""
        self._logs_dir = logs_dir
        self._server_url = server_url
        self._poll_interval = poll_interval
        self._rotate_threshold_bytes = rotate_threshold_bytes
        self._state = CollectorState(logs_dir)
        self._running = False

    def run(self) -> None:
        """主循环：scan → read_new_events → push_spans → update_state → rotate_if_needed。

        推送失败记录错误但不中断循环（offset 未更新，下轮重试）。
        """
        self._running = True

        while self._running:
            try:
                self._poll_once()
            except Exception as e:
                logger.error("轮询异常: %s", e)

            # 等待下一轮，但每 0.05s 检查一次退出标志
            wait_end = time.monotonic() + self._poll_interval
            while self._running and time.monotonic() < wait_end:
                time.sleep(0.05)

    def stop(self) -> None:
        """设置退出标志，当前轮次结束后退出。"""
        self._running = False

    def _poll_once(self) -> None:
        """执行一轮 scan → read → push → save → rotate。"""
        entries = scan_logs_dir(self._logs_dir)

        for entry in entries:
            file_path = entry["file_path"]
            offset = self._state.get_offset(file_path)

            events, new_offset = read_new_events(file_path, offset)

            if not events:
                # 即使没有新事件，也检查轮转（offset 可能已到文件末尾）
                self._rotate_if_needed(file_path)
                continue

            try:
                push_spans(self._server_url, events)
            except Exception as e:
                logger.error("推送失败，下一轮重试: %s", e)
                # 不更新 offset，下轮重试
                continue

            # 推送成功，更新 offset
            self._state.set_offset(file_path, new_offset)
            self._state.save()

            # 检查轮转
            self._rotate_if_needed(file_path)

    def _rotate_if_needed(self, file_path: str) -> None:
        """文件大小超过 rotate_threshold_bytes 且 offset == 文件大小时，
        重命名为 events.{%Y%m%d_%H%M%S}.done.jsonl。
        SDK 下次 open('a') 会自动创建新文件。
        """
        try:
            file_size = os.path.getsize(file_path)
        except OSError:
            return

        offset = self._state.get_offset(file_path)

        if file_size >= self._rotate_threshold_bytes and offset >= file_size:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dir_name = os.path.dirname(file_path)
            done_name = os.path.join(dir_name, f"events.{timestamp}.done.jsonl")
            try:
                os.rename(file_path, done_name)
                logger.info("日志轮转: %s → %s", file_path, done_name)
                # 重置该文件的 offset（文件已不存在，新文件从 0 开始）
                self._state.set_offset(file_path, 0)
                self._state.save()
            except OSError as e:
                logger.error("轮转失败: %s", e)
