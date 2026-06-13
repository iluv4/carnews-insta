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
planner → retriever → copywriter → designer → image_gen → ocr_gate → art_director
                          ▲                                               │
                          └─────────────────── reviser ◄──────────────────┘   (loop)
                                                  │
                                                 END   (scores ≥ thresholds or max revisions)
```

| Node | Model | Job |
|------|-------|-----|
| `planner` | GPT-5.5 | topic → per-slide role + intent |
| `retriever` | embeddings | **RAG**: top-k similar real templates (pgvector or in-process) |
| `copywriter` | GPT-5.5 | slide copy, grounded in retrieved exemplars |
| `designer` | GPT-5.5 | full-card prompt that **bakes the exact Korean copy into the image** (names the literal strings to render) |
| `image_gen` | **gpt-image-2** | renders the finished card — headline/bullets/footer baked in, not a separate text layer |
| `ocr_gate` | GPT-5.5 vision | transcribes the rendered text and **diffs it against the intended copy** (`difflib`); numbers/dates/URLs are a hard fail. The safety net that makes baking text safe |
| `art_director` | GPT-5.5 vision | scores the finished card for legibility/correctness/composition (requires the baked text, no longer penalises it) |
| `reviser` | — | merges the OCR gate's + critic's fixes into next-pass instructions, loops back |

The `… → ocr_gate → art_director → reviser → designer` cycle is the point: a
one-shot generator can't self-correct. The loop gates on **two** signals —
text fidelity (`ocr_gate`) and aesthetics (`art_director`) — and re-renders until
both clear their thresholds (`AGENT_TEXT_THRESHOLD`, `AGENT_QUALITY_THRESHOLD`).

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
  → **SSE** stream: `start` → `node` (one per graph step) → `done`

## Tests

```bash
python -m pytest tests/         # or: python -c "import tests.test_graph as t; ..."
```

Tests run fully offline (fallback paths), asserting node order, RAG retrieval,
and the critic routing logic.
