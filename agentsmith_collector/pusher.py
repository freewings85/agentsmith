"""推送事件到 Server /api/spans。"""

import logging
import requests

logger = logging.getLogger(__name__)


def push_spans(server_url: str, events: list[dict]) -> None:
    """POST events 到 {server_url}/api/spans，处理网络异常。"""
    if not events:
        return

    url = f"{server_url.rstrip('/')}/api/spans"
    try:
        resp = requests.post(url, json=events, timeout=30)
    except requests.ConnectionError as e:
        logger.error("无法连接到 Server %s: %s", url, e)
        raise
    except requests.Timeout as e:
        logger.error("推送 spans 超时 %s: %s", url, e)
        raise
    except requests.RequestException as e:
        logger.error("推送 spans 请求异常 %s: %s", url, e)
        raise

    # 检查 HTTP 状态码
    try:
        status = resp.status_code
        if status >= 400:
            logger.error("Server 返回 HTTP %d: %s", status, url)
    except AttributeError:
        pass
