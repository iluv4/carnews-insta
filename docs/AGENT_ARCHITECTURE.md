# Agentic Card-News Generation — Architecture

This document describes the RAG + multi-agent system introduced alongside the
`agent-service/` (FastAPI + LangGraph) microservice. It replaces the previous
single forward-pass (`analyze → copy → render`) with a **retrieval-grounded,
self-correcting agent graph**.

## Two services, one job each

```
┌──────────────────────────┐        SSE / HTTP        ┌───────────────────────────────┐
│        Next.js app       │ ───────────────────────► │   agent-service (Python)      │
│  UI · Auth · Prisma · DB │ ◄─────────────────────── │   FastAPI + LangGraph         │
│  Fabric.js canvas render │     node-by-node events  │   the orchestration "brain"   │
└──────────────────────────┘                          └───────────────────────────────┘
            │                                                       │
            ▼                                                       ▼
     Postgres (Neon) ◄───── shared ─────────────────────►  pgvector index
                                                            gpt-image-2 / GPT-5.5 / GPT-5.2
```

The web app owns presentation and persistence; the agent service owns AI
orchestration. `src/app/api/agent-generate/route.ts` is a thin SSE pass-through.

## The agent graph (LangGraph `StateGraph`)

```
planner → retriever → copywriter → designer → image_gen → art_director
                          ▲                                    │
                          └──────────── reviser ◄──────────────┘   (cycle)
                                           │
                                          END   (score ≥ threshold OR max revisions)
```

1. **planner** (GPT-5.5) — decomposes the topic into per-slide roles + intent.
2. **budgeter** (Test-Time Scaling) — estimates the topic's difficulty and forces
   the per-request inference budget (Best-of-N sample count + revision ceiling).
   See [Test-Time Scaling](#test-time-scaling-no-gpu) below.
3. **retriever** (RAG) — embeds the topic and pulls the top-k most similar of
   the 45 real saved templates. This is genuine retrieval: we ground generation
   in human-made designs, not the model's prior. Backed by **pgvector** when
   `DATABASE_URL` is set, otherwise an in-process numpy index, otherwise a
   lexical (token + CJK-bigram) fallback so dev works with no key.
4. **copywriter** (GPT-5.5) — writes slide copy conditioned on the retrieved
   exemplars' tone. Runs **Best-of-N self-consistency**: samples `n_samples`
   candidates (the budget forced above), scores each with a reward judge, keeps
   the best.
5. **designer** (GPT-5.5) — composes the art-direction prompt for the image
   model, folding in any revision notes from a previous loop.
6. **image_gen** (**gpt-image-2**) — full-card render. Text is baked into the
   image (the chosen design), using the 2026 model's 2K multilingual text.
7. **art_director** (GPT-5.2 vision) — scores the render against a rubric
   (readability/contrast, hierarchy, Korean typography, brand consistency,
   artifacts) and lists concrete fixes.
8. **reviser** — converts those fixes into instructions and **loops back** to
   the designer. Repeats until the score clears `AGENT_QUALITY_THRESHOLD` or
   the budget's revision ceiling is hit.

### Why this isn't a glorified prompt chain

- **It has a cycle.** `art_director → reviser → designer` is a feedback loop, the
  thing a plain pipeline can't express. LangGraph models it as first-class state
  + conditional edges with a bounded iteration count.
- **It's retrieval-grounded.** The old `/api/match` sent only template *names* to
  the model and asked it to guess. The retriever embeds *actual design content*
  and ranks by cosine similarity — real RAG.
- **It self-evaluates.** A vision critic closes the loop, so quality is measured,
  not assumed.

## Test-Time Scaling (no GPU)

Quality is raised with **inference** compute only — no fine-tuning, no GPU, no
extra training data. Two techniques from the test-time-scaling literature, in
`agent-service/app/tts.py`:

- **Best-of-N self-consistency** (`copywriter`). A single greedy decode is high
  variance: one draft can fumble the hook. Instead we sample N copy candidates
  (candidate 0 greedy, the rest at temperature for diversity), score each with a
  reward judge (`score_copy` — an LLM editor, or a deterministic heuristic with
  no key), and keep the best. More samples → more reliably good copy.
- **Budget forcing — S1** (`budgeter`). Spending a flat N on every request wastes
  compute on easy topics and starves hard ones. The budgeter estimates topic
  difficulty (0..1) and maps it to a budget: easy → 1 sample + the default
  revision cap; hard → up to `AGENT_TTS_MAX_SAMPLES` + a higher revision ceiling.
  That budget flows into the copywriter (N) and every `render_slide` critique
  loop (revision ceiling).

This is the project's analogue of pushing a small model toward frontier
reasoning *without* training it — the "Method 01" path for teams with no GPU.

| Knob | Default | Env |
|------|---------|-----|
| TTS on/off | `true` | `AGENT_TTS_ENABLED` |
| Best-of-N range | `1`–`4` | `AGENT_TTS_MIN_SAMPLES` / `AGENT_TTS_MAX_SAMPLES` |
| Candidate temperature | `0.9` | `AGENT_TTS_TEMPERATURE` |
| Revision ceiling (hard topics) | `4` | `AGENT_TTS_MAX_REVISIONS_CEILING` |

The `/healthz` response reports the active TTS config, and every `/generate`
`done` event carries a `tts` block (difficulty, candidates scored, chosen
reward, full budget) for observability.

## Models (2026-06)

| Role | Default | Override env |
|------|---------|--------------|
| Reasoning / copy | `gpt-5.5` | `AGENT_TEXT_MODEL` |
| Vision critic | `gpt-5.2` | `AGENT_VISION_MODEL` |
| Image | `gpt-image-2` | `AGENT_IMAGE_MODEL` |
| Embeddings | `text-embedding-3-large` | `AGENT_EMBED_MODEL` |

All are env-overridable; nothing is hard-pinned to a snapshot that could be
deprecated.

## Graceful degradation

Every node has a deterministic fallback, mirroring the existing `hasKey()`
pattern in the Next.js routes: with no `OPENAI_API_KEY` the graph still runs
end-to-end (stub copy, lexical RAG, no image), so the system is demoable and
testable offline. See `agent-service/tests/`.
