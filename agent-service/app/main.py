"""FastAPI entrypoint for the card-news agent service.

Endpoints:
  GET  /healthz      liveness + config snapshot
  GET  /rag/info     how many templates are indexed and with what backend
  POST /generate     run the agent graph, stream node-by-node progress as SSE
  POST /resume       resume a review-paused run with the reviewer's decision
"""
from __future__ import annotations

import json
from typing import Any, AsyncGenerator
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .config import get_settings
from .graph import build_graph, run_linear, _HAS_LANGGRAPH
from .rag.store import get_store
from .schemas import AgentState, GenerateRequest, ResumeRequest

if _HAS_LANGGRAPH:
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

# Compiled once with an in-process checkpointer so a review interrupt can suspend
# during /generate and resume on a later /resume (same thread_id). MemorySaver is
# dev/single-instance; swap for a Postgres checkpointer for multi-instance prod.
_GRAPH: Any = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph(checkpointer=MemorySaver())
    return _GRAPH

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
            # Human-in-the-loop review needs the checkpointer-backed graph.
            "review": _HAS_LANGGRAPH,
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
        "review_enabled": req.review,
        "review": {},
        "revision": 0,
        "revision_notes": [],
        "max_revisions": s.max_revisions,
        "threshold": s.quality_threshold,
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _done_payload(values: dict) -> dict:
    return {
        "copy": values.get("copy"),
        "examples": values.get("examples"),
        # The whole deck — one rendered background per slide.
        "cards": values.get("final_cards", []),
        # Cover-based single-card view, kept for backward compatibility.
        "image_prompt": values.get("image_prompt"),
        "card_image_b64": values.get("card_image_b64"),
        "score": values.get("score"),
        "critique": values.get("critique"),
        "revisions": values.get("revision", 0),
        "provider": values.get("provider"),
    }


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


async def _drive(graph, inp, config) -> AsyncGenerator[tuple[str, dict], None]:
    """Stream a graph run, distinguishing node updates from a review interrupt."""
    async for chunk in graph.astream(inp, config, stream_mode="updates"):
        if "__interrupt__" in chunk:
            yield "interrupt", dict(chunk["__interrupt__"][0].value)
            continue
        for node_name, partial in chunk.items():
            yield "node", {"node": node_name, "update": _slim(partial or {})}


async def _drive_stream(graph, inp, thread_id: str) -> AsyncGenerator[str, None]:
    """Common SSE tail: emit node events, then either `review` (paused) or `done`."""
    config = _config(thread_id)
    interrupted: dict | None = None
    async for kind, data in _drive(graph, inp, config):
        if kind == "node":
            yield _sse("node", data)
        else:
            interrupted = data
    if interrupted is not None:
        yield _sse("review", {"thread_id": thread_id, **interrupted})
    else:
        yield _sse("done", _done_payload(graph.get_state(config).values))


async def _stream(req: GenerateRequest) -> AsyncGenerator[str, None]:
    # Without langgraph, fall back to the linear runner (no review gate).
    if not _HAS_LANGGRAPH:
        state = _initial_state(req)
        yield _sse("start", {"topic": req.topic, "num_slides": req.num_slides})
        for node_name, partial in run_linear(state):
            yield _sse("node", {"node": node_name, "update": _slim(partial)})
        yield _sse("done", _done_payload(state))
        return

    thread_id = uuid4().hex
    yield _sse("start", {"topic": req.topic, "num_slides": req.num_slides, "thread_id": thread_id})
    async for chunk in _drive_stream(get_graph(), _initial_state(req), thread_id):
        yield chunk


async def _stream_resume(req: ResumeRequest) -> AsyncGenerator[str, None]:
    yield _sse("start", {"thread_id": req.thread_id, "resumed": True})
    async for chunk in _drive_stream(get_graph(), Command(resume=req.decision), req.thread_id):
        yield chunk


def _slim_card(card: dict) -> dict:
    c = dict(card)
    if c.get("card_image_b64"):
        c["card_image_b64"] = f"<{len(c['card_image_b64'])} bytes>"
    return c


def _slim(partial: dict) -> dict:
    """Drop the heavy base64 payloads from per-node SSE updates."""
    out = dict(partial)
    if out.get("card_image_b64"):
        out["card_image_b64"] = f"<{len(out['card_image_b64'])} bytes>"
    for key in ("cards", "final_cards"):
        if isinstance(out.get(key), list):
            out[key] = [_slim_card(c) for c in out[key]]
    return out


_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@app.post("/generate")
async def generate(req: GenerateRequest) -> StreamingResponse:
    return StreamingResponse(_stream(req), media_type="text/event-stream", headers=_SSE_HEADERS)


@app.post("/resume")
async def resume(req: ResumeRequest):
    """Resume a review-paused run. Requires langgraph (checkpointer-backed)."""
    if not _HAS_LANGGRAPH:
        return JSONResponse({"error": "resume requires langgraph"}, status_code=400)
    return StreamingResponse(
        _stream_resume(req), media_type="text/event-stream", headers=_SSE_HEADERS
    )
