import os
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core import Settings
from llama_index.llms.ollama import Ollama
from llama_index.tools.tavily_research import TavilyToolSpec
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware  # 关键：导入跨域中间件


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
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
async def ask_endpoint(request: Request):
    print('开始查询')
    try:
        body = await request.json()
        context = body.get("context", "")
        print(context)
        question = body.get("question", "")
        print(question)

        if not context:
            return {"error": "No context provided"}

        # 构建用户问题，结合上下文和问题
        if question:
            user_msg = f"基于以下上下文: {context}\n\n问题: {question}\n\n请用中文回复。"
        else:
            user_msg = f"请总结以下文本: {context}\n\n请用中文回复。"

        response = await workflow.run(user_msg=user_msg)
        print(response)
        return {"answer": str(response)}
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return {"error": str(e)}