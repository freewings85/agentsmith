"""LangChain AgentMiddleware 集成。"""

import time
from typing import Any

import langchain_core.agents


class AgentMiddleware:
    """Agent 中间件基类。"""

    async def awrap_model_call(self, call_next):
        """包装模型调用。子类重写此方法。"""
        raise NotImplementedError


# 注入到 langchain_core.agents，使 from langchain_core.agents import AgentMiddleware 可用
if not hasattr(langchain_core.agents, "AgentMiddleware"):
    langchain_core.agents.AgentMiddleware = AgentMiddleware

from .logger import AgentSmithLogger


class AgentSmithMiddleware(AgentMiddleware):
    """拦截 LLM 调用，自动记录 LLM_START 和 LLM_END 事件。"""

    def __init__(self, logger: AgentSmithLogger):
        self.logger = logger

    async def awrap_model_call(self, call_next):
        """包装模型调用，记录 LLM 事件。"""

        async def wrapped(messages):
            # 记录 LLM_START
            input_data: dict[str, Any] = {}
            if messages:
                input_data["messages"] = [
                    {"type": getattr(m, "type", "unknown"),
                     "content": getattr(m, "content", str(m))}
                    for m in messages
                ]
            self.logger._log("LLM_START", name="llm", data={"input": input_data})

            # 执行实际调用
            start_time = time.time()
            result = await call_next(messages)
            duration_ms = int((time.time() - start_time) * 1000)

            # 记录 LLM_END
            output_data: dict[str, Any] = {
                "content": getattr(result, "content", str(result)),
            }
            tool_calls = getattr(result, "tool_calls", [])
            if tool_calls:
                output_data["tool_calls"] = tool_calls
            self.logger._log("LLM_END", name="llm",
                             data=output_data, duration_ms=duration_ms)

            return result

        return wrapped
