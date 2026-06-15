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
2. **retriever** (RAG) — embeds the topic and pulls the top-k most similar of
   the 45 real saved templates. This is genuine retrieval: we ground generation
   in human-made designs, not the model's prior. Backed by **pgvector** when
   `DATABASE_URL` is set, otherwise an in-process numpy index, otherwise a
   lexical (token + CJK-bigram) fallback so dev works with no key.
3. **copywriter** (GPT-5.5) — writes slide copy conditioned on the retrieved
   exemplars' tone.
4. **designer** (GPT-5.5) — composes the art-direction prompt for the image
   model, folding in any revision notes from a previous loop.
5. **image_gen** (**gpt-image-2**) — full-card render. Text is baked into the
   image (the chosen design), using the 2026 model's 2K multilingual text.
6. **art_director** (GPT-5.2 vision) — scores the render against a rubric
   (readability/contrast, hierarchy, Korean typography, brand consistency,
   artifacts) and lists concrete fixes.
7. **reviser** — converts those fixes into instructions and **loops back** to
   the designer. Repeats until the score clears `AGENT_QUALITY_THRESHOLD` or
   `AGENT_MAX_REVISIONS` is hit.

### Why this isn't a glorified prompt chain

- **It has a cycle.** `art_director → reviser → designer` is a feedback loop, the
  thing a plain pipeline can't express. LangGraph models it as first-class state
  + conditional edges with a bounded iteration count.
- **It's retrieval-grounded.** The old `/api/match` sent only template *names* to
  the model and asked it to guess. The retriever embeds *actual design content*
  and ranks by cosine similarity — real RAG.
- **It self-evaluates.** A vision critic closes the loop, so quality is measured,
  not assumed.

## Human-in-the-loop: human evaluation that feeds back

The critique→revision loop above is fully automated (`art_director` is the judge).
But the same loop also accepts a **human** as the critic, so a person's eyes can
drive regeneration — and that feedback is collected to improve the system over time.

```
human score + fixes ─▶ human_critic ─▶ reviser ─▶ designer ─▶ image_gen ─▶ art_director(re-score)
        │                                                                         │
        └────────────────────────── feedback_store (JSONL) ──────────────────────┘
                                              │
                 ┌────────────────────────────┼─────────────────────────────┐
                 ▼                             ▼                             ▼
        edit-cost metric            preference re-ranking            preference dataset
        (Table 1, measure_control)  (retriever up-ranks liked        (future fine-tuning /
                                     templates in *future* runs)      learned reward)
```

- **Immediate reflection.** `POST /revise` takes a card's context + a
  `HumanFeedback {score, notes, seconds}`. `human_critic` converts it into the
  exact `{score, fixes}` contract `art_director` produces, so the existing
  `reviser → designer → image_gen` path re-renders the card guided by the human,
  then the automated critic re-scores it. The response carries
  `auto_score_before/after` so the human-driven improvement is visible.
- **Collection.** Every revision is appended to an append-only JSONL
  (`AGENT_FEEDBACK_LOG`, default `agent-service/data/feedback.jsonl`) by
  `feedback_store`. No DB required — same offline-first principle as the RAG store.
- **Future-run improvement.** `retriever` blends similarity with each template's
  mean human score (`AGENT_PREF_WEIGHT`), so designs people rated highly surface
  more in later generations. `GET /feedback/stats` summarizes counts, mean score,
  mean auto-score gain, and the top templates.
- **Paper Table 1.** `scripts/measure_control.py --feedback-log` reads the same
  JSONL to fill the edit-cost row from real human sessions.

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
