import os
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core import Settings
from llama_index.llms.ollama import Ollama
from llama_index.tools.tavily_research import TavilyToolSpec
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # 关键：导入跨域中间件


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.100.70:11434"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.environ["TAVILY_API_KEY"] = "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" # 替换你的 Tavily Key

llm=Ollama(
        model="Qwen3:8b",
        request_timeout=360.0,
        # Manually set the context window to limit memory usage
        context_window=8000,
    )
Settings.llm = llm

tool_spec = TavilyToolSpec(
    api_key=os.environ["TAVILY_API_KEY"],
)

workflow = FunctionAgent(
    name="Agent",
    description="Useful for performing financial operations.",
    tools=tool_spec.to_tool_list(),
    system_prompt="You are a helpful assistant.",
)

@app.post("/api/ask")
async def main():
    print('开始查询')
    response = await workflow.run(
        user_msg="Who is Ben Afflecks spouse? 用中文回复"
    )
    print(response)
    return response