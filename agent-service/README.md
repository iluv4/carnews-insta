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
planner → retriever → copywriter → designer → image_gen → art_director
                          ▲                                    │
                          └──────────── reviser ◄──────────────┘   (loop)
                                           │
                                          END   (score ≥ threshold or max revisions)
```

| Node | Model | Job |
|------|-------|-----|
| `planner` | GPT-5.5 | topic → per-slide role + intent |
| `retriever` | embeddings | **RAG**: top-k similar real templates (pgvector or in-process) |
| `copywriter` | GPT-5.5 | slide copy, grounded in retrieved exemplars |
| `designer` | GPT-5.5 | art-direction prompt for the image model |
| `image_gen` | **gpt-image-2** | text-free background render (Korean text is overlaid by the client, never baked — diffusion garbles Korean glyphs) |
| `art_director` | GPT-5.5 vision | scores the background against a rubric (penalises any stray text) |
| `reviser` | — | turns critic fixes into next-pass instructions, loops back |

The `art_director → reviser → designer` cycle is the point: a one-shot generator
can't self-correct; this graph re-renders until the card clears the quality bar.

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
