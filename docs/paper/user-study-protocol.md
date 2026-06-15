# IntentCard — User Study Protocol (v0.1)

> A controlled, within-subjects study to test whether IntentCard helps design
> non-experts realize design intent better than existing tools. This document is the
> pre-registerable plan: hypotheses, conditions, tasks, measures, and analysis are
> fixed *before* data collection. No results are recorded here.

---

## 1. Research questions & hypotheses

**RQ.** Does IntentCard let non-experts produce card-news that is more faithful to
their design intent, faster, and with less effort than existing tools?

| ID | Hypothesis (vs both baselines unless noted) |
| :--- | :--- |
| H1 | Intent fidelity (3rd-party rating) is higher with IntentCard (C) than Canva (A) and direct image-model (B). |
| H2 | Completion time is lower with C than A. |
| H3 | Brand-consistency error (color ΔE, font mismatch) is lower with C than B. |
| H4 | Subjective workload (NASA-TLX) is lower, satisfaction (SUS) higher, with C. |
| H5 | "This is what I intended" agreement is higher with C. |

Primary outcome: **H1 (intent fidelity)**. Others are secondary.

---

## 2. Design

- **Type:** within-subjects (repeated measures), 3 conditions, counterbalanced.
- **Conditions:**
  - **A — Canva** (manual, templates available).
  - **B — Direct image model** (gpt-image-2 with text baked in; free prompting).
  - **C — IntentCard** (our system).
- **Counterbalancing:** Latin square over condition order to control learning/fatigue.
- **Briefs:** 3 distinct *intent briefs* (see §4), each used once per participant;
  brief↔condition assignment rotated so every brief appears in every condition across
  participants.

### Participants
- **Population:** design non-experts who actually need card-news — small-business
  owners, solo marketers, field-sales agents (e.g., insurance), early-stage founders.
- **Exclusion:** professional designers; daily Canva power-users.
- **Target N:** 18–24 (within-subjects; power analysis below). Recruit to demographic
  balance on age and category.
- **Compensation:** fixed honorarium; disclosed up front.
- **Ethics/IRB:** obtain approval (or institutional exemption) before recruiting;
  written informed consent; right to withdraw; data pseudonymized.

---

## 3. Procedure (≈60–75 min / participant)

1. **Consent & intake** (5 min): demographics, prior tool experience, self-rated design
   skill (1–7).
2. **Tutorial** (5 min/condition, capped): identical-length scripted intro to each tool;
   one throwaway practice card not analyzed.
3. **Tasks** (3 × ~12 min): one brief per condition (order per Latin square). The
   participant produces a 3-slide card-news set. Hard time cap (e.g., 15 min) recorded
   as right-censored if hit.
4. **Per-task survey** (3 min): SUS, NASA-TLX, intent-agreement, satisfaction.
5. **Semi-structured interview** (10 min): where intent was lost/preserved; what they
   could/couldn't control; preference ranking with reasons.
6. **Debrief.**

Sessions screen+audio recorded (with consent); all artifacts (final cards + edit logs +
intermediate states) saved with the metric harness (`scripts/measure_control.py`).

---

## 4. Tasks (intent briefs)

Each brief fixes an *intent* but not the execution, and includes a concrete brand
constraint so objective control metrics apply. Example set:

- **B1 — Insurance promotion.** "Warm, trustworthy card for a neighborhood insurance
  shop; brand navy **#1A237E** + gold; audience in their 50s; headline 한국어." 3 slides:
  hook / benefit / contact.
- **B2 — Café new menu.** "Cozy, premium small café; brand color **#6D4C41**; audience
  20–30s; playful but clean." 3 slides: teaser / menu / event.
- **B3 — Startup hiring.** "Confident, modern early-stage startup; brand **#0F9D58**;
  audience junior developers." 3 slides: who we are / role / how to apply.

Held constant across conditions: target dimensions (2:3), slide count (3), available
time, identical brand spec sheet handed to the participant.

---

## 5. Measures

### 5.1 Objective (logged / computed; see `scripts/measure_control.py`)
| Measure | Definition |
| :--- | :--- |
| Completion time | start → participant declares "done" (censored at cap) |
| Brand color ΔE | CIEDE2000 between brief HEX and rendered text/accent color |
| Font match | rendered typeface == brand spec (exact-by-construction for C overlay) |
| Reproducibility variance | per-pixel std across N=5 identical re-runs of the final spec |
| Edit cost | #edits and seconds to change one headline word (scripted micro-task) |
| Intent alignment | CLIPScore(brief text ↔ final card) |

### 5.2 Subjective (per task)
- **Intent fidelity (primary):** 2–3 independent raters (incl. ≥1 professional
  designer), blind to condition, score 1–7 "how well does this card match the brief's
  intent?"; report inter-rater reliability (ICC/Krippendorff α).
- **Self intent-agreement:** participant 1–7 "this is what I intended."
- **SUS** (usability, 10 items), **NASA-TLX** (workload, 6 items), single-item
  satisfaction, and a forced-rank preference across A/B/C.

---

## 6. Analysis plan

- **Primary (H1):** intent fidelity ~ condition with participant + brief as random
  effects (linear mixed model); or Friedman + Nemenyi post-hoc if assumptions fail.
  Report effect sizes (Kendall's W / Cliff's δ) and 95% CIs.
- **Time (H2):** mixed model on log-time; treat cap-hits as censored (or report
  separately).
- **Control metrics (H3):** ΔE and reproducibility compared C vs B with
  Wilcoxon signed-rank; expect near-zero for C by construction.
- **Workload/satisfaction (H4):** mixed models / Friedman per scale.
- **Multiplicity:** pre-register primary = H1; control family-wise error on secondary
  tests (Holm).
- **Qualitative:** thematic analysis of interviews to explain *why* control was
  gained/lost (triangulates the quantitative result).

### Power (rough)
For a within-subjects effect on the primary 1–7 rating, a medium effect
(dz ≈ 0.7) at α=.05, power=.8 needs ≈ 17 participants → target **N=20** with buffer for
dropouts/rater disagreement. Finalize after a pilot (n=3–4) that also checks timing,
tutorial parity, and rater calibration.

---

## 7. Threats to validity & mitigations

| Threat | Mitigation |
| :--- | :--- |
| "Intent fidelity" is subjective | structured brief + blind multi-rater + report reliability |
| Tool-familiarity confound (Canva known) | scripted equal tutorials; exclude power-users; counterbalance |
| Unfair quality contest vs big generator | compete on *control* metrics, not aesthetic preference |
| Experimenter bias | blind raters; fixed scripts; pre-registered analysis |
| Order/learning effects | Latin-square counterbalancing; practice card discarded |
| Small/again Korea-centric sample | report demographics; frame scope; future cross-locale work |

---

## 8. Artifacts to retain (for reproducibility / appendix)
final cards (all conditions) · edit logs · intermediate states · per-task surveys ·
anonymized interview transcripts · the exact briefs & brand spec sheets · metric
outputs from `scripts/measure_control.py`.

**[DATA TBD]** — populate Results only after the pilot and main study are run.
