# Critic eval harness

A small harness to (1) guard the Art Director critic's deterministic scoring
math and (2) measure how the real vision critic scores your card backgrounds.

## 1. Logic self-test (no API key, CI-safe)

Verifies the weighted aggregation + text-gate math in
`app/nodes/art_director.py`:

```bash
cd agent-service
python eval/run_eval.py --self-test
```

## 2. Score real images

Put card-background PNGs in `eval/samples/`, list them in a JSONL manifest
(see `cases.sample.jsonl`), set `OPENAI_API_KEY` (or point at Qwen3-VL via
`OPENAI_BASE_URL` + `AGENT_VISION_MODEL`, see `app/config.py`), then:

```bash
python eval/run_eval.py --cases eval/cases.sample.jsonl --out eval/report.md
```

This writes `eval/report.md` (human-readable table) and `eval/report.json`.
Add an `expected` band (`good|ok|bad`) to each case to get **band accuracy**
against your own labels — that's how you tell whether a prompt/model change
actually improved the critic instead of guessing.

## Rubric

The critic grades five weighted axes (see `RUBRIC_WEIGHTS`):

| axis | weight | what it measures |
| --- | --- | --- |
| composition | 0.25 | 구도 / 시각적 위계 |
| overlay_space | 0.25 | 하단 텍스트 오버레이용 여백 |
| color_mood | 0.20 | 색 · 무드의 매력 |
| cleanliness | 0.15 | 잡티 · 아티팩트 없음 |
| text_free | 0.15 | 이미지 내 글자 없음 (위반 시 점수 상한 4.0) |

The overall score is aggregated **in Python**, not by the model, so the quality
gate is stable and explainable.
