"""FastAPI entrypoint for the card-news agent service.

Endpoints:
  GET  /healthz      liveness + config snapshot
  GET  /rag/info     how many templates are indexed and with what backend
  POST /generate     run the agent graph, stream node-by-node progress as SSE
"""
from __future__ import annotations

import json
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .config import get_settings
from .graph import build_graph, run_linear, _HAS_LANGGRAPH
from .rag.store import get_store
from .schemas import AgentState, GenerateRequest

app = FastAPI(title="carnews-agent", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm() -> None:
    get_store()  # index templates once at boot


@app.get("/healthz")
def healthz() -> JSONResponse:
    s = get_settings()
    return JSONResponse(
        {
            "ok": True,
            "langgraph": _HAS_LANGGRAPH,
            "openai": s.has_openai,
            "models": {"text": s.text_model, "vision": s.vision_model, "image": s.image_model},
        }
    )


@app.get("/rag/info")
def rag_info() -> JSONResponse:
    store = get_store()
    embedded = sum(1 for d in store.docs if d.vector)
    return JSONResponse(
        {
            "templates_indexed": len(store.docs),
            "embedded": embedded,
            "backend": "embeddings" if embedded else "lexical-fallback",
            "top_k": get_settings().rag_top_k,
        }
    )


def _initial_state(req: GenerateRequest) -> AgentState:
    s = get_settings()
    return {
        "topic": req.topic,
        "num_slides": req.num_slides,
        "brand": req.brand,
        "audience": req.audience,
        "render_image": req.render_image,
        "revision": 0,
        "revision_notes": [],
        "max_revisions": s.max_revisions,
        "threshold": s.quality_threshold,
        "text_threshold": s.text_threshold,
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream(req: GenerateRequest) -> AsyncGenerator[str, None]:
    state = _initial_state(req)
    yield _sse("start", {"topic": req.topic, "num_slides": req.num_slides})

    # Prefer the real LangGraph runtime; fall back to the linear runner so the
    # service is functional even before langgraph is installed.
    if _HAS_LANGGRAPH:
        graph = build_graph()
        async for chunk in graph.astream(state, stream_mode="updates"):
            for node_name, partial in chunk.items():
                state.update(partial or {})
                yield _sse("node", {"node": node_name, "update": _slim(partial or {})})
    else:
        for node_name, partial in run_linear(state):
            yield _sse("node", {"node": node_name, "update": _slim(partial)})

    yield _sse(
        "done",
        {
            "copy": state.get("copy"),
            "examples": state.get("examples"),
            "image_prompt": state.get("image_prompt"),
            "card_image_b64": state.get("card_image_b64"),
            "score": state.get("score"),
            "text_score": state.get("text_score"),
            "ocr_text": state.get("ocr_text"),
            "critique": state.get("critique"),
            "revisions": state.get("revision", 0),
            "provider": state.get("provider"),
        },
    )


def _slim(partial: dict) -> dict:
    """Drop the heavy base64 payload from per-node SSE updates."""
    out = dict(partial)
    if out.get("card_image_b64"):
        out["card_image_b64"] = f"<{len(out['card_image_b64'])} bytes>"
    return out


@app.post("/generate")
async def generate(req: GenerateRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
