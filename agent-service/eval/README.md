# Critic Evaluation — is the quality gate trustworthy?

The agent loop uses the **Art Director** vision critic's 0~10 score as its
quality gate: a card is re-generated until the score clears
`AGENT_QUALITY_THRESHOLD`. That only means something if the score tracks human
judgement. This harness measures exactly that.

## What it reports

For a golden set of `(rendered card, human score)` pairs it runs the real critic
and computes:

| Metric | Meaning |
|--------|---------|
| **Pearson r** | linear agreement between human and critic scores |
| **Spearman ρ** | rank agreement (robust to scale/offset) |
| **MAE / RMSE** | average / penalised score error |
| **threshold agreement** | do human & critic agree on pass/fail at the gate? (+ confusion tp/tn/fp/fn) |

## Run

```bash
cd agent-service

# 1) Harness check — no key, no images needed (passthrough at threshold)
python -m eval.critic_eval --golden eval/golden_set.example.jsonl

# 2) Real eval — needs OPENAI_API_KEY and a filled golden set
python -m eval.critic_eval --golden eval/golden_set.jsonl --json out/critic_report.json
```

## Building the golden set

1. Generate cards (`POST /generate`) and save each background PNG.
2. Score each yourself 0~10 with the **same rubric** the critic uses
   (hierarchy · palette · overlay space · artifacts · no baked-in text).
3. Put one JSON line per card in `golden_set.jsonl` — see
   `golden_set.example.jsonl` for the schema (`id`, `image_path`, `human_score`,
   `note`). ~10–15 cards is enough to be directional.

> Small-n caveat: with fewer than ~8 cards the correlations are directional, not
> statistically significant. The harness prints this reminder automatically.

## Why it exists

Validating the judge is the honest counterpart to *using* a judge. This closes
the gap flagged in `docs/PROFESSOR_SHOWCASE.md` §8 (Q5) — "측정 안 함 < 불완전하게라도
측정" — and is a concrete, reproducible artifact to show alongside the demo.
No `numpy`/`scipy` dependency: the statistics are pure-Python so the eval runs
anywhere the service does.
