"""推送事件到 Server /api/spans。"""

import requests


def push_spans(server_url: str, events: list[dict]) -> None:
    """POST events 到 {server_url}/api/spans。"""
    if not events:
        return

    url = f"{server_url.rstrip('/')}/api/spans"
    requests.post(url, json=events)
