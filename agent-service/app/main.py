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

from .analyze import analyze_reference
from .config import get_settings
from .feedback_store import log_feedback, score_correlation, stats as feedback_stats
from .graph import build_graph, run_linear, revise_with_feedback, _HAS_LANGGRAPH
from .rag.store import get_store
from .schemas import AgentState, AnalyzeRequest, GenerateRequest, ReviseRequest

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
            "tts": {
                "enabled": s.tts_enabled,
                "samples": [s.tts_min_samples, s.tts_max_samples],
                "max_revisions_ceiling": s.tts_max_revisions_ceiling,
            },
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
            # The whole deck — one rendered background per slide.
            "cards": state.get("final_cards", []),
            # Cover-based single-card view, kept for backward compatibility.
            "image_prompt": state.get("image_prompt"),
            "card_image_b64": state.get("card_image_b64"),
            "score": state.get("score"),
            "critique": state.get("critique"),
            "revisions": state.get("revision", 0),
            "provider": state.get("provider"),
            # Test-Time Scaling diagnostics: how much inference compute this
            # request was granted and the reward of the chosen copy.
            "tts": {
                "difficulty": state.get("difficulty"),
                "copy_candidates": state.get("copy_candidates"),
                "copy_reward": state.get("copy_reward"),
                "budget": state.get("budget"),
            },
        },
    )


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


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> JSONResponse:
    """Read the Korean text + describe the layout of one reference card image.

    Perception task — runs on GPT-5.5 by default, or Qwen3-VL via AGENT_ANALYZE_*.
    """
    return JSONResponse(analyze_reference(req.image))


@app.post("/generate")
async def generate(req: GenerateRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/revise")
def revise(req: ReviseRequest) -> JSONResponse:
    """Human-in-the-loop revision: a person's evaluation re-renders one card and
    is logged for edit-cost metrics + preference learning."""
    s = get_settings()
    state: AgentState = {
        "topic": req.topic,
        "brand": req.brand,
        "audience": req.audience,
        "examples": req.examples,
        "copy": {"slides": [req.slide]},
        "design_brief": req.design_brief,
        "image_prompt": req.image_prompt,
        "render_image": req.render_image,
        "revision": 0,
        "revision_notes": [],
        "threshold": s.quality_threshold,
        "max_revisions": s.max_revisions,
        "auto_score_before": req.auto_score_before,
        "human_feedback": req.feedback.model_dump(),
    }
    result = revise_with_feedback(state)

    record = log_feedback(
        {
            "kind": "revise",
            "topic": req.topic,
            "template_ids": [e.get("template_id") for e in req.examples if e.get("template_id")],
            "human_score": result["human_score"],
            "human_notes": req.feedback.notes,
            "auto_score_before": result["auto_score_before"],
            "auto_score_after": result["auto_score_after"],
            "seconds": req.feedback.seconds,
            "regenerations": 1,
            "condition": "human-critic",
        }
    )

    return JSONResponse(
        {
            # The regenerated card, including its image bytes when rendered.
            "card": result["card"],
            "human_score": result["human_score"],
            "auto_score_before": result["auto_score_before"],
            "auto_score_after": result["auto_score_after"],
            "logged_at": record["ts"],
        }
    )


@app.get("/feedback/stats")
def feedback_stats_endpoint() -> JSONResponse:
    """Aggregate human feedback: counts, mean score, auto-score gain, top templates,
    and the auto↔human score correlation (does the auto-judge match human eyes?)."""
    out = feedback_stats()
    out["auto_vs_human"] = score_correlation()
    return JSONResponse(out)
