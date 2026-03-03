"""CLI 入口：python -m agentsmith_collector。

支持 --logs-dir DIR --server-url URL [--poll-interval N] [--rotate-threshold N]
注册 SIGINT/SIGTERM 信号调用 daemon.stop() 实现优雅退出。
"""

import argparse
import logging
import signal
import sys

from agentsmith_collector.daemon import CollectorDaemon

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def main():
    parser = argparse.ArgumentParser(
        prog="agentsmith_collector",
        description="AgentSmith Collector Daemon：持续监听日志目录并推送到 Server。",
    )
    parser.add_argument(
        "--logs-dir",
        required=True,
        help="日志根目录路径（包含 {conversation_id}/events.jsonl）",
    )
    parser.add_argument(
        "--server-url",
        required=True,
        help="AgentSmith Server URL（如 http://127.0.0.1:18900）",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=5,
        help="轮询间隔秒数（默认 5）",
    )
    parser.add_argument(
        "--rotate-threshold",
        type=int,
        default=5 * 1024 * 1024,
        help="日志轮转阈值字节数（默认 5MB）",
    )

    args = parser.parse_args()

    daemon = CollectorDaemon(
        logs_dir=args.logs_dir,
        server_url=args.server_url,
        poll_interval=args.poll_interval,
        rotate_threshold_bytes=args.rotate_threshold,
    )

    # 注册信号处理，优雅退出
    def _signal_handler(signum, frame):
        logging.info("收到退出信号 (%s)，正在停止...", signal.Signals(signum).name)
        daemon.stop()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    logging.info(
        "Collector Daemon 启动: logs_dir=%s, server_url=%s, poll_interval=%.1f",
        args.logs_dir,
        args.server_url,
        args.poll_interval,
    )
    daemon.run()
    logging.info("Collector Daemon 已停止。")


if __name__ == "__main__":
    main()
