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
planner → budgeter → retriever → copywriter ─┬─▶ render_slide ─┐
                                             ├─▶ render_slide ─┼─▶ collect → END
                                             └─▶ render_slide ─┘
                                              (one branch per slide, in parallel)

each render_slide branch:
    designer → image_gen → art_director
        ▲                       │
        └──── reviser ◄─────────┘   (loop until score ≥ threshold or revision ceiling)
```

| Node | Model | Job |
|------|-------|-----|
| `planner` | GPT-5.5 | topic → per-slide role + intent |
| `budgeter` | GPT-5.5 / heuristic | **Test-Time Scaling**: difficulty → inference budget (Best-of-N count + revision ceiling) |
| `retriever` | embeddings | **RAG**: top-k similar real templates (pgvector or in-process) |
| `copywriter` | GPT-5.5 | **Best-of-N self-consistency** copy for every slide, grounded in retrieved exemplars |
| *(fan-out)* | — | `Send` dispatches one `render_slide` branch per slide, run in parallel |
| `render_slide` | — | one card end-to-end (designer → image_gen → art_director → reviser loop) |
| └ `designer` | GPT-5.5 | art-direction prompt for the image model |
| └ `image_gen` | **gpt-image-2** | text-free background render (Korean text is overlaid by the client, never baked — diffusion garbles Korean glyphs) |
| └ `art_director` | GPT-5.5 vision | scores the background on a **5-axis weighted rubric** (composition / overlay_space / color_mood / cleanliness / text_free); the overall score is aggregated deterministically in Python so the gate is stable and explainable |
| └ `reviser` | — | turns critic fixes into next-pass instructions, loops back |
| `collect` | — | fans the finished cards back in, ordered (deck score = weakest slide) |

Three things are the point here:

1. The per-card `art_director → reviser → designer` **cycle** — a one-shot
   generator can't self-correct; each branch re-renders until its card clears
   the quality bar.
2. The **fan-out**: `num_slides` slides are rendered as parallel `render_slide`
   branches (LangGraph's `Send` map-reduce), so an N-slide deck costs roughly the
   wall-clock time of one card instead of N.
3. **Test-Time Scaling (no GPU)**: `budgeter` + Best-of-N self-consistency raise
   quality with inference compute alone — and *budget forcing* (S1) spends that
   compute proportional to topic difficulty. See
   [`docs/AGENT_ARCHITECTURE.md`](../docs/AGENT_ARCHITECTURE.md#test-time-scaling-no-gpu)
   and `app/tts.py`.

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
- `POST /generate` — `{ "topic", "num_slides", "brand?", "audience?", "render_image?" }`
  → **SSE** stream: `start` → `node` (one per graph step; `render_slide` fires
  once per slide) → `done`. The `done` payload carries `cards` — the full deck,
  one rendered background per slide — plus a cover-based single-card view
  (`card_image_b64`, `score`, …) kept for backward compatibility.
- `POST /analyze` — `{ "image" }` (base64 / data URL) → reads the **Korean text**
  (OCR) and describes the **layout** of a reference card as structured JSON
  (`text_blocks`, `layout`, `summary`). A *perception* task, so it runs on
  GPT-5.5 by default but **flips to Qwen3-VL** (or any OpenAI-compatible VLM)
  by setting `AGENT_ANALYZE_MODEL` / `AGENT_ANALYZE_BASE_URL` / `AGENT_ANALYZE_API_KEY`
  — no GPU on your side, so Railway stays CPU-only.

## Eval

A small harness scores the Art Director critic — see [`eval/`](eval/README.md):

```bash
python eval/run_eval.py --self-test                              # deterministic, no key (CI)
python eval/run_eval.py --cases eval/cases.sample.jsonl --out eval/report.md   # real images
```

## Tests

```bash
python -m pytest tests/         # or: python -c "import tests.test_graph as t; ..."
```

Tests run fully offline (fallback paths), asserting node order, RAG retrieval,
and the critic routing logic.
