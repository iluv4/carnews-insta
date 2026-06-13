# carnews-agent (FastAPI + LangGraph)

The "brain" of the card-news generator, split out from the Next.js app. It runs
a **stateful multi-agent graph** with a real critique→revision **loop** and
**RAG** over the 45 saved Instagram templates.

## Why a separate service

The Next.js app stays responsible for what it's good at — UI, auth, DB, and
rendering. Orchestration logic (cyclic agent graph, retrieval, vision critique)
lives here in Python where the LangGraph + OpenAI tooling is most mature. The
two talk over HTTP/SSE.

## The graph

```
planner → retriever → copywriter ─┬─▶ render_slide ─┐
                                  ├─▶ render_slide ─┼─▶ collect → review_gate ─▶ END (approve)
                                  └─▶ render_slide ─┘                  │
                                   (one branch per slide, in parallel)  └──▶ render_slide (revise)

each render_slide branch:
    designer → image_gen → art_director
        ▲                       │
        └──── reviser ◄─────────┘   (loop until score ≥ threshold or max revisions)
```

| Node | Model | Job |
|------|-------|-----|
| `planner` | GPT-5.5 | topic → per-slide role + intent |
| `retriever` | embeddings | **RAG**: top-k similar real templates (pgvector or in-process) |
| `copywriter` | GPT-5.5 | copy for **every** slide, grounded in retrieved exemplars |
| *(fan-out)* | — | `Send` dispatches one `render_slide` branch per slide, run in parallel |
| `render_slide` | — | one card end-to-end (designer → image_gen → art_director → reviser loop) |
| └ `designer` | GPT-5.5 | art-direction prompt for the image model |
| └ `image_gen` | **gpt-image-2** | text-free background render (Korean text is overlaid by the client, never baked — diffusion garbles Korean glyphs) |
| └ `art_director` | GPT-5.5 vision | scores the background against a rubric (penalises any stray text) |
| └ `reviser` | — | turns critic fixes into next-pass instructions, loops back |
| `collect` | — | fans the finished cards back in, ordered (deck score = weakest slide) |
| `review_gate` | — | **human-in-the-loop** (opt-in): `interrupt()` pauses for approve / partial revise |

Three things are the point here:

1. The per-card `art_director → reviser → designer` **cycle** — a one-shot
   generator can't self-correct; each branch re-renders until its card clears
   the quality bar.
2. The **fan-out**: `num_slides` slides are rendered as parallel `render_slide`
   branches (LangGraph's `Send` map-reduce), so an N-slide deck costs roughly the
   wall-clock time of one card instead of N.
3. The **human-in-the-loop** gate (set `review: true`): `interrupt()` + a
   checkpointer pause the graph after the deck so a person can approve or send
   fixes. A `revise` decision re-renders **only the selected slides** (the `cards`
   reducer merges by index), then pauses again — loop until approved. Off by
   default, so the one-shot path is unchanged.

## Run

```bash
cd agent-service
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

Everything degrades gracefully without a key (deterministic stub copy + lexical
RAG), so `GET /healthz`, `GET /rag/info`, and `POST /generate` all work in dev.

## API

- `GET /healthz` — liveness + which models/back-ends are active
- `GET /rag/info` — templates indexed + retrieval backend
- `POST /generate` — `{ "topic", "num_slides", "brand?", "audience?", "render_image?", "review?" }`
  → **SSE** stream: `start` (carries a `thread_id`) → `node` (one per graph step;
  `render_slide` fires once per slide) → `done`. The `done` payload carries
  `cards` — the full deck, one rendered background per slide — plus a cover-based
  single-card view (`card_image_b64`, `score`, …) kept for backward compatibility.
  When `review: true`, the stream ends in a **`review`** event instead of `done`
  (`{ thread_id, cards, score, ask }`) — the run is paused awaiting a decision.
- `POST /resume` — `{ "thread_id", "decision" }` resumes a paused run.
  `decision` = `{ "action": "approve" }` to finish, or
  `{ "action": "revise", "notes": [...], "slides": [0,2] }` to re-render those
  slides (omit `slides` to revise all). Streams the same events; ends in `done`
  on approval or another `review` after a revise. Requires langgraph (the
  checkpointer-backed graph); returns 400 otherwise.

## Tests

```bash
python -m pytest tests/         # or: python -c "import tests.test_graph as t; ..."
```

Tests run fully offline (fallback paths), asserting node order, RAG retrieval,
the critic routing logic, the review-gate routing, and the full interrupt →
partial-revise → approve human-in-the-loop cycle.
