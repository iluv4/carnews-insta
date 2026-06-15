# IntentCard: Helping Non-Experts Realize Design Intent in Controllable AI Card-News Generation

**Draft v0.1 — 2026-06-14**
*Target venue: CHI / UIST / DIS / HCI Korea (system + user study)*

> NOTE TO AUTHORS: Sections marked **[DATA TBD]** require real experiments before
> submission. Do not report numbers that have not been measured.

---

## Abstract

Small-business owners and design non-experts hold clear *design intent* — "make it
feel trustworthy," "premium," "for a Gen-Z audience" — yet translating that intent
into finished social card-news requires either design skill or prompt-engineering
expertise. Contemporary image generators (e.g., gpt-image-2) produce visually strong
results, but they (i) cannot *enforce* exact brand fonts, kerning, and colors,
(ii) do not allow post-hoc text editing because output is raster, and (iii) are
non-deterministic, which undermines the reproducibility and reliability that a
commercial workflow demands. We argue that the bottleneck for non-experts is not
generation *quality* but generation *control*. We present **IntentCard**, a system
that lets non-experts realize design intent in a controllable way through four
mechanisms: (1) converting abstract intent into structured design attributes,
(2) retrieving reference "design DNA" via embeddings to ground generation (RAG),
(3) a vision-based self-correction loop that critiques and revises until an intent
and quality threshold is met, and (4) a *text-free background + editable typographic
overlay* that structurally guarantees brand consistency, editability, and
reproducibility. We evaluate IntentCard with control-fidelity metrics (color ΔE,
font match, reproducibility variance, edit cost, CLIPScore) and a within-subjects
user study with non-expert participants, comparing against Canva and direct use of
an image model. **[DATA TBD]**

**Keywords:** human-AI co-creation, design intent, controllable generation,
card-news, retrieval-augmented generation, typography.

---

## 1. Introduction

Visual *card-news* — short, multi-slide image posts that package information for
social feeds — has become a primary marketing channel for small businesses, and its
importance has grown as social platforms increasingly favor multi-image carousel
content. A neighborhood insurance agent, a café owner, or a small marketing team now
routinely needs a steady stream of on-brand cards. Producing them well, however,
still presupposes design competence: one must choose a layout, a palette, typography,
and imagery that *together* communicate a brand's intent. Non-experts who lack that
competence either learn a tool like Canva, pay for outsourcing, or settle for results
that miss what they had in mind.

The recent wave of text-to-image models appears to dissolve this barrier. In practice
it *relocates* it. Contemporary generators produce visually compelling imagery and —
contrary to a common assumption — render Korean text well. The difficulty a non-expert
hits is no longer that the model cannot draw; it is that the user cannot reliably bend
the model to their **intent**. Consider an agent who wants "a warm, trustworthy card
for a neighborhood insurance shop, navy (#1A237E) and gold, aimed at customers in
their fifties." With a raw image model they still cannot (a) *enforce* the exact brand
navy and typeface, (b) edit a single word of the headline afterward without
regenerating — and thereby altering — the whole image, or (c) obtain the *same* card
twice. These are not quality failures. They are **control** failures. And for a
commercial user, control — consistency, editability, reproducibility — is not a
nicety; it is the product.

This reframing is the conceptual core of our work. The dominant research narrative
treats card-news/poster generation as a *generation-quality* problem and competes on
fidelity and aesthetics. We argue that for the non-expert population the binding
constraint has shifted to *controllability of intent*. Two short formative
interviews motivated and sharpened this view: an insurance field-sales agent (a
non-expert who needs branded, trustworthy cards on short notice) and a card-news
developer/outsourcer (an expert who could articulate the production workflow). The
non-expert's recurring frustration was precisely the gap between a clear intent and an
uncontrollable output; the expert's account let us distil the tacit rules — how layout,
copy, and styling decisions are actually made — into an explicit production guide that
we encode as machine-actionable guidance. From the same study we assembled a corpus of
~40 real card-news references that anchors retrieval and layout analysis.

We therefore pose the research question:

> **RQ.** How can an AI system help design non-experts (e.g., small-business owners)
> translate abstract design intent into card-news that is *accurate to that intent,
> brand-consistent, editable, and reproducible*?

We answer it with **IntentCard**, a system built on a deliberately modest thesis:
*we do not propose a stronger generator; we let a non-expert control a strong one.*
The design follows directly from the failure modes above. To capture intent, IntentCard
elicits and structures it before any pixels are drawn. To ground generation in proven
human design rather than the model's prior, it retrieves "design DNA" from the reference
corpus. To make consistency, editability, and reproducibility *structural* rather than
best-effort, it separates a generated text-free background from an editable typographic
layer. And to close the loop on quality and intent, a vision-based critic revises until
a threshold is met. Concretely, IntentCard contributes:

1. **Intent-to-design elicitation.** A persona-grounded step that converts free-form
   intent plus a business category into structured design attributes — the
   machine-actionable specification consumed downstream.
2. **Design-DNA retrieval (RAG) with multimodal layout analysis.** Embedding search
   over a corpus of real, human-made templates, parsed into structural elements, that
   grounds copy and design in proven exemplars — in the spirit of retrieval-augmented
   layout generation such as RALF [Horita et al., CVPR 2024].
3. **A control-guaranteeing render pipeline.** A *text-free* background plus an
   *editable typographic overlay*, which turns brand consistency, editability, and
   reproducibility into structural guarantees rather than hoped-for outcomes — the
   central contribution.
4. **A vision-based self-correction loop.** An "art director" critic (a multimodal
   LLM) scores candidates against intent and quality, driving revision until a
   threshold is met (LLM-as-aesthetic-judge).

We evaluate IntentCard along two axes that mirror the reframing. First, *objective
control-fidelity metrics* (brand-color ΔE, font match, reproducibility variance, edit
cost, and CLIPScore intent-alignment) quantify control against a strong baseline that
bakes text directly into the image. Second, a *within-subjects user study* with
non-expert participants compares IntentCard to Canva (manual tooling) and to direct
image-model prompting on completion time, intent fidelity, satisfaction, and workload.
We deliberately compete on control, not raw aesthetic preference, to avoid an unfair
quality contest against a far larger generator. **[DATA TBD]**

---

## 2. Related Work

**Content-aware layout & graphic generation.** A line of work generates where design
elements should go conditioned on the canvas: CGL-GAN and PDA-GAN [Zhou et al. 2022;
arXiv:2604.07409] place elements while avoiding salient regions; PosterLayout
[arXiv:2303.15937] offers a benchmark and content/graphic metrics (occlusion,
readability, overlap, alignment); recent diffusion- and LLM-based methods (LayoutDiT,
PosterLlama [ECCV 2024], SEGA [ICCV 2025]) push quality further. IntentCard borrows
these *metrics* to quantify placement quality and could adopt a GAN layout module for
typographic placement.

**Retrieval-augmented generation for visuals.** RALF [Horita et al., CVPR 2024]
retrieves nearest layouts to condition generation; retrieval-augmented diffusion
(RDM, KNN-Diffusion) and Re-Imagen ground image synthesis in retrieved neighbors.
Our design-DNA store applies the same principle to *design exemplars* for copy and
styling.

**Text rendering in generated images.** CLIP's weak text encoder limits spelling
fidelity; methods like GlyphControl, TextDiffuser, and AnyText, and strong-text-
encoder systems (Imagen/T5, Ideogram), improve in-image text. For CJK/Hangul,
GlyphGAN and component-guided Hangul generation address the compositional script.
IntentCard deliberately *sidesteps* in-image text for the caption layer, treating
typography as an editable overlay so correctness is guaranteed rather than learned.

**Vision–language representations.** CLIP [Radford et al., ICML 2021] provides the
image/text embeddings we use for retrieval and the CLIPScore intent-alignment metric.

**Human-AI co-creation tools (HCI).** Prior systems lower the barrier to creative
production for non-experts; IntentCard's contribution is specifically *controllability
of intent* (consistency, editability, reproducibility) measured with both objective
metrics and a user study.

---

## 3. System Design

### 3.0 Formative study & design-knowledge elicitation

The system is grounded in a small formative study. We interviewed prospective users
who produce card-news under real constraints — an **insurance field-sales agent**
(a non-expert who needs branded, trustworthy cards) and a **card-news developer/
outsourcer** (an expert who articulates the production workflow). From these
interviews we (a) identified the core pain point — non-experts can describe intent
but cannot reliably control output — and (b) distilled an explicit *card-news
production guide* that encodes how experts make layout, copy, and styling decisions.
This guide is operationalized as a system prompt, turning tacit expert knowledge into
machine-actionable guidance. We additionally collected a corpus of ~40 real card-news
references as the basis for design-DNA retrieval and layout analysis (§3.3).

### 3.1 Overview

IntentCard is two services: a Next.js front-end (UI, auth, persistence, a Fabric.js
canvas editor) and a Python `agent-service` (FastAPI + LangGraph) that orchestrates a
node graph. They share a Postgres database; retrieval runs either against pgvector or,
in the default local mode, an in-process index.

```
intent (NL + category)
   │  [planner]        elicit + structure intent → design attributes
   ▼
   │  [retriever]      RAG over design-DNA templates (embedding search)
   ▼
   │  [copywriter]     intent-grounded Korean copy (few-shot from retrieved exemplars)
   │  [designer]       layout / palette / type spec
   ▼
   │  [image_gen]      TEXT-FREE background (gpt-image-2)
   ▼
   │  [art_director]   multimodal critic scores vs intent + quality
   │  [reviser] ───────┘ loop until threshold or max_revisions
   ▼
editable typographic overlay (crisp Korean, brand font/color enforced)
   ▼
Fabric.js canvas — human-in-the-loop edit
```

### 3.2 Intent-to-design elicitation

Non-experts express intent in natural language and a business category. A
persona-grounded prompt-refinement step maps this to structured attributes
{tone, audience, key message, brand palette, category, mood}, which become the
machine-actionable specification the rest of the pipeline consumes.

### 3.3 Design-DNA retrieval (RAG)

We maintain a corpus of 45 real, human-made card-news templates. Each template is a
list of design elements (background/title/body/graphic); we flatten it into a compact
natural-language *design summary* that serves as the retrieval document. We embed
summaries (text-embedding-3-large) and retrieve top-k by cosine similarity to the
intent query; a lexical (token/bigram-overlap) fallback keeps the system usable
without API access. Retrieved exemplars are passed as few-shot grounding to the
copywriter and designer — we retrieve *real designs*, not the model's prior.

**Multimodal layout analysis.** Whereas earlier multimodal work focused on image
*captioning*, recent work shifts toward analyzing image *layout/structure*. We use a
multimodal analyzer (e.g., document/image layout analysis and a vision LLM) to parse
each reference card into its structural elements — the "design DNA" — so retrieval and
the designer node operate over layout structure (element roles, positions, palette),
not just surface pixels. This makes the retrieved grounding structural and editable.

### 3.4 Control-guaranteeing render pipeline (core contribution)

Rather than ask the generator to bake Korean text into the image, IntentCard
generates a **text-free background** and renders the caption as an **editable
typographic overlay** in the browser. This converts three best-effort properties into
structural guarantees:

- **Brand consistency:** exact font, kerning, and HEX color are enforced by the
  renderer (zero deviation), not approximated by the model.
- **Editability:** any character can be edited after generation without regenerating
  the image.
- **Reproducibility:** the typographic layer is deterministic given the same spec.

### 3.5 Self-correction loop

An "art director" critic (multimodal LLM, GPT-5.5) scores each candidate against the
structured intent and a quality rubric. If the score is below threshold, a reviser
node adjusts the spec and regenerates, up to `max_revisions`. This LLM-as-aesthetic-
judge loop is the system's self-improving mechanism.

---

## 4. Implementation

- **Front-end:** Next.js 16, React 19, Fabric.js 7 canvas editor; Prisma 7 + Postgres
  (Neon).
- **Agent service:** FastAPI + LangGraph; nodes `planner, retriever, copywriter,
  designer, image_gen, art_director, reviser`; SSE streams node-by-node events to the
  UI; slide fan-out generates `num_slides` cards in parallel.
- **Models (env-overridable):** GPT-5.5 for text/vision reasoning and the critic,
  gpt-image-2 for background generation, text-embedding-3-large for retrieval.
- **RAG store:** pgvector when `DATABASE_URL` is present; otherwise an in-process
  numpy index built at startup; lexical fallback without an API key. A
  `check_embed.py` script verifies the live embedding path. The research
  configuration runs locally in in-process mode for full reproducibility.

---

## 5. Evaluation

We evaluate two complementary claims: (E1) IntentCard provides measurably better
*control* than direct image-model use; (E2) non-experts realize their intent more
effectively with IntentCard than with existing tools.

### 5.1 E1 — Control-fidelity metrics (objective)

Baseline: direct gpt-image-2 generation with the caption baked into the image.
For a fixed set of intents/specs, we measure:

| Property | Metric | Procedure |
| :--- | :--- | :--- |
| Brand color | ΔE (CIEDE2000) between target HEX and rendered text color | sample text pixels |
| Brand font | font-match rate | template vs output typeface |
| Reproducibility | variance across N identical runs | pixel/text-layer diff |
| Editability | time / regenerations to change one character | scripted edit task |
| Intent alignment | CLIPScore (intent text ↔ output image) | CLIP ViT |
| Placement | occlusion, readability, overlap, alignment (PosterLayout metrics) | saliency map |

Expected: the overlay layer yields ~0 color ΔE, exact font match, near-zero
reproducibility variance, and constant-time edits, where the baked-in baseline cannot.
**[DATA TBD]**

### 5.2 E2 — User study (subjective, the core HCI evidence)

- **Design:** within-subjects, N non-expert / small-business participants.
- **Conditions:** A = Canva (manual), B = direct image-model prompting,
  C = IntentCard. Order counterbalanced.
- **Task:** given the *same* design intent brief, produce a card-news set.
- **Measures:** completion time; intent fidelity (self-rated + third-party designer
  rating); satisfaction (SUS); workload (NASA-TLX); number of edits; "this is what I
  intended" agreement rate.
- **Hypotheses:** C reduces completion time and increases intent fidelity and
  satisfaction vs A and B.
- **Analysis:** repeated-measures ANOVA / Friedman with post-hoc; report effect sizes.

**[DATA TBD]** — results, figures, and statistics to be added after the study.

### 5.3 Threats to validity

Operationalizing "intent fidelity" is the main risk; we mitigate with structured
attributes plus independent designer ratings. Because a strong generator already
produces good visuals, we frame the comparison on *control*, not raw aesthetic
preference, to avoid an unfair quality contest.

---

## 6. Discussion & Limitations

IntentCard does not advance generative model quality and does not claim to. Its
contribution is a controllability layer and an interaction model that let non-experts
direct existing models toward their intent. Limitations: the design-DNA corpus is
small (45) and Korea-centric; the self-correction critic inherits LLM judgment bias;
the user study population must be representative of actual small-business owners.

## 7. Conclusion

We presented IntentCard, a system that reframes AI card-news creation for non-experts
from a generation problem to a *control* problem, and guarantees brand consistency,
editability, and reproducibility through a text-free background plus editable
typography, grounded by design-DNA retrieval and refined by a vision-based
self-correction loop. We evaluate with objective control metrics and a user study.
**[DATA TBD]**

---

## References (to be formatted to venue style)

1. Radford et al. *Learning Transferable Visual Models From Natural Language
   Supervision.* ICML 2021. arXiv:2103.00020.
2. Horita et al. *Retrieval-Augmented Layout Transformer for Content-Aware Layout
   Generation.* CVPR 2024.
3. *PosterLayout: A New Benchmark and Approach for Content-aware Visual-Textual
   Presentation Layout.* 2023. arXiv:2303.15937.
4. Zhou et al. *Composition-aware / image-aware layout (CGL-GAN).* 2022.
5. *GAN-based Domain Adaptation for Image-aware Layout Generation (PDA-GAN).*
   arXiv:2604.07409.
6. *PosterLlama: Content-Aware Layout Generation.* ECCV 2024.
7. Wang et al. *SEGA: Stepwise Evolution for Content-Aware Layout Generation.*
   ICCV 2025.
8. *GlyphControl / TextDiffuser / AnyText* (in-image text rendering).
9. *GlyphGAN: Style-consistent font generation based on GANs.*
10. Rombach et al. *High-Resolution Image Synthesis with Latent Diffusion Models.*
    CVPR 2022.
