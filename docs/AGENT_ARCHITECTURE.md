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
planner → retriever → copywriter → designer → image_gen → ocr_gate → art_director
                          ▲                                               │
                          └─────────────────── reviser ◄──────────────────┘   (cycle)
                                                  │
                                                 END   (text & design scores OK, OR max revisions)
```

1. **planner** (GPT-5.5) — decomposes the topic into per-slide roles + intent.
2. **retriever** (RAG) — embeds the topic and pulls the top-k most similar of
   the 45 real saved templates. This is genuine retrieval: we ground generation
   in human-made designs, not the model's prior. Backed by **pgvector** when
   `DATABASE_URL` is set, otherwise an in-process numpy index, otherwise a
   lexical (token + CJK-bigram) fallback so dev works with no key.
3. **copywriter** (GPT-5.5) — writes slide copy conditioned on the retrieved
   exemplars' tone.
4. **designer** (GPT-5.5) — composes the full-card image prompt that **bakes the
   exact Korean copy into the image**, naming the literal strings to render and
   folding in any revision notes from a previous loop.
5. **image_gen** (**gpt-image-2**) — full-card render. Text is baked into the
   image (the chosen design — "박기 올인"), using the 2026 model's multilingual
   text rendering. The output is a publishable card, not an editable draft.
6. **ocr_gate** (GPT-5.5 vision + `difflib`) — the text-fidelity safety net that
   makes baking text safe. It transcribes the text actually visible in the card
   (OCR, no guessing) and diffs it against the intended copy for a 0–10
   `text_score`. Numbers/dates/URLs must match character-for-character (one wrong
   digit caps the score). A low score loops back for a re-render.
7. **art_director** (GPT-5.5 vision) — scores the finished card against a rubric
   (baked-text correctness/legibility, contrast, hierarchy, palette/mood,
   artifacts) and lists concrete fixes. It now *requires* the baked text instead
   of penalising it.
8. **reviser** — merges the OCR gate's + critic's fixes into instructions and
   **loops back** to the designer. Repeats until **both** scores clear their
   thresholds (`AGENT_TEXT_THRESHOLD`, `AGENT_QUALITY_THRESHOLD`) or
   `AGENT_MAX_REVISIONS` is hit.

### Why this isn't a glorified prompt chain

- **It has a cycle.** `art_director → reviser → designer` is a feedback loop, the
  thing a plain pipeline can't express. LangGraph models it as first-class state
  + conditional edges with a bounded iteration count.
- **It's retrieval-grounded.** The old `/api/match` sent only template *names* to
  the model and asked it to guess. The retriever embeds *actual design content*
  and ranks by cosine similarity — real RAG.
- **It self-evaluates on two axes.** A deterministic OCR diff (`ocr_gate`) closes
  the loop on text correctness and a vision critic (`art_director`) on aesthetics,
  so quality is measured, not assumed.

## The evaluation stack — what's built vs. what's next

The handoff design framed quality as a 3-layer CV problem. Where we are:

| Layer | What it does | Status |
|------|--------------|--------|
| **1 — deterministic** | OCR transcription + `difflib` diff vs. intended copy; hard fail on numbers/dates/URLs | ✅ **`ocr_gate`** (this is the MVP version: VLM-OCR + stdlib diff) |
| **2a — LLM-as-judge** | vision rubric scoring (legibility, hierarchy, palette) | ✅ **`art_director`** |
| **2b — style consistency** | embed the rendered card and each retrieved exemplar, score cosine similarity so a *set* of cards stays on-style | 🔜 **next node: `style_gate`** — needs an image-embedding model (CLIP / `open_clip`); slots in right after `ocr_gate`, gates the loop on a third `style_score` |
| **3 — offline eval** | a **golden set** of 20–30 hand-scored cards to validate the judges themselves (does `art_director`'s score track human judgement?) + spot-checks of auto-passed cards | 🔜 **next: eval harness** — a labelled fixtures dir + a `pytest` that runs the judges over it and reports correlation; not a graph node but a CI gate on judge quality |

> **What building these actually changes:** `style_gate` adds one more node and a
> third threshold to `_route_after_critic`, so a card can be re-rendered for being
> *off-brand* even if its text is correct and it's individually pretty. The
> **golden set** doesn't touch the runtime graph — it's how you trust the judges:
> without it, a lenient `art_director` silently passes bad cards and you'd never
> know. It's the difference between "we have a critic" and "we know our critic is
> calibrated."

## Models (2026-06)

| Role | Default | Override env |
|------|---------|--------------|
| Reasoning / copy | `gpt-5.5` | `AGENT_TEXT_MODEL` |
| Vision critic + OCR gate | `gpt-5.5` | `AGENT_VISION_MODEL` |
| Image | `gpt-image-2` | `AGENT_IMAGE_MODEL` |
| Embeddings (text RAG) | `text-embedding-3-large` | `AGENT_EMBED_MODEL` |

All are env-overridable; nothing is hard-pinned to a snapshot that could be
deprecated.

## Graceful degradation

Every node has a deterministic fallback, mirroring the existing `hasKey()`
pattern in the Next.js routes: with no `OPENAI_API_KEY` the graph still runs
end-to-end (stub copy, lexical RAG, no image), so the system is demoable and
testable offline. See `agent-service/tests/`.
