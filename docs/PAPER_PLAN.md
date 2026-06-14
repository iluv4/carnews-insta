# IntentCard — 연구·서비스 종합 정리

> 비전공자(소상공인)가 **디자인 의도를 통제 가능하게** 카드뉴스로 실현하도록 돕는
> RAG + 멀티에이전트 생성 시스템. 본 문서는 (1) 지금까지 만든 것, (2) 논문 초록,
> (3) 연구 방향, (4) 개발 현황을 한 곳에 모은 기준 문서다.

작성 기준일: 2026-06-14 · 대상 투고처: CHI / UIST / DIS / HCI Korea (HCI 시스템 + 사용자 스터디)

---

## 0. 한 줄 요지 (Positioning)

우리는 **더 강한 생성 모델을 제안하지 않는다.** 대신 **비전공자가 강한 생성 모델
(gpt-image-2 등)을 자기 의도대로 통제**하게 만든다 — 브랜드 일관성·편집성·재현성을
구조적으로 보장함으로써.

핵심 전환: 문제는 "모델이 한글/이미지를 못 만든다"가 **아니다**. gpt-image-2는 잘 만든다.
진짜 문제는 **"비전공자가 추상적 디자인 의도를 결과물에 정확히 반영·통제하기 어렵다"**는 것.

---

## 1. 지금까지 만든 것 (개발 현황)

### 1.1 아키텍처 (2-서비스)

```
Next.js 앱 (UI·Auth·Prisma·Fabric.js 캔버스)  ◄──SSE/HTTP──►  agent-service (FastAPI + LangGraph)
        │                                                              │
        ▼                                                              ▼
   Postgres(Neon) ◄───────── 공유 ─────────────────►  pgvector 인덱스 / gpt-image-2 · GPT-5.5
```

### 1.2 구현된 핵심 기능 (= 논문 시스템 모듈)

| 모듈 | 현재 구현 | 논문에서의 역할 |
| :--- | :--- | :--- |
| 의도 → 구조화 | 페르소나 기반 프롬프트 자동 다듬기 | 비전공자의 추상 의도를 디자인 속성으로 변환 |
| RAG 검색 | 45개 인스타 템플릿 임베딩 → 유사 디자인 검색 (LangGraph `retriever`) | 의도에 맞는 검증된 "디자인 DNA" 근거 제공 |
| 멀티에이전트 생성 | `planner → retriever → copywriter → designer → image_gen` | few-shot 근거 기반 카피·디자인 생성 |
| 자기수정 루프 | `art_director`(비전 비평) → `reviser` → 재생성 | 의도 충족·품질 임계치까지 반복 |
| 배경/타이포 분리 | gpt-image-2로 **글자 없는 배경** + 브라우저 CSS 타이포 오버레이 | 브랜드 일관성·편집성·재현성을 구조적으로 보장 |
| 슬라이드 fan-out | num_slides만큼 카드 병렬 생성 | 다중 카드뉴스 |
| 캔버스 에디터 V2.1 | Fabric.js, 정밀 핸들·스냅, 글래스모피즘 툴바 | 생성 후 사람-개입 편집 |

> 상태: 위 기능은 동작. **RAG 배포(Railway pgvector)** 안정화는 별도 과제로 **후순위 보류**.

---

## 2. 논문 초록 (Abstract 초안)

### 국문

소상공인과 디자인 비전공자는 "신뢰감 있게", "프리미엄하게", "20대 타깃" 같은 분명한
**디자인 의도**를 갖지만, 이를 실제 카드뉴스로 옮기려면 디자인 스킬이나 프롬프트
숙련이 필요하다. 최신 이미지 생성 모델은 시각 품질은 뛰어나지만, (i) 브랜드 폰트·자간·
색을 정확히 강제하지 못하고, (ii) 생성 후 텍스트 편집이 불가하며(래스터), (iii) 같은
입력에도 결과가 달라 상업적 신뢰성이 낮다. 본 연구는 비전공자가 디자인 의도를 **통제
가능하게** 실현하도록 돕는 시스템 **IntentCard**를 제안한다. IntentCard는 (1) 추상 의도를
구조화된 디자인 속성으로 변환하고, (2) 레퍼런스 "디자인 DNA"를 검색(RAG)해 생성 근거로
삼으며, (3) 비전 기반 자기수정 루프로 품질을 보정하고, (4) **글자 없는 배경 생성 + 편집
가능한 타이포 오버레이**로 브랜드 일관성·편집성·재현성을 구조적으로 보장한다. 통제
지표(색차 ΔE, 폰트 일치율, 재현성 분산, 편집 비용)와 비전공자 N명 대상 사용자 스터디에서,
IntentCard는 Canva 및 이미지 모델 직접 사용 대비 의도 충실도와 완성 효율을 유의하게
개선했다.

### English

Small-business owners and design non-experts hold clear *design intent* — "make it
feel trustworthy," "premium," "for a Gen-Z audience" — yet translating that intent
into finished card-news requires design skill or prompt expertise. Modern image
generators produce high visual quality but (i) cannot enforce exact brand fonts,
kerning, and colors, (ii) do not allow post-hoc text editing (raster output), and
(iii) yield non-deterministic results that undermine commercial reliability. We
present **IntentCard**, a system that helps non-experts realize design intent in a
*controllable* way. IntentCard (1) converts abstract intent into structured design
attributes, (2) retrieves reference "design DNA" (RAG) to ground generation, (3)
refines quality via a vision-based self-correction loop, and (4) structurally
guarantees brand consistency, editability, and reproducibility through
**text-free background generation plus an editable typographic overlay**. On control
metrics (color ΔE, font match, reproducibility variance, edit cost) and a user study
with N non-experts, IntentCard significantly improves intent fidelity and completion
efficiency over Canva and direct use of image models.

---

## 3. 연구 방향 (문제·기여·평가)

### 3.1 연구 질문 (RQ)

> 디자인 비전공자(소상공인)가 **추상적 의도**를 실제 카드뉴스로 **정확·일관·편집
> 가능하게** 옮기는 것을, AI 시스템이 어떻게 쉽게 만들 수 있는가?

### 3.2 기여 (Contributions)

1. **의도→설계 변환**: 자연어 의도 + 업종을 구조화된 디자인 속성으로 변환(페르소나 프롬프트).
2. **디자인 DNA 검색(RAG)**: 레퍼런스 임베딩 검색으로 의도에 맞는 근거 제공 (cf. RALF).
3. **통제 보장 메커니즘** ⭐: 배경 생성/타이포 분리로 **브랜드 일관성·편집성·재현성**을
   구조적으로 보장 — 이게 핵심이며 정량 측정의 대상(Table 1).
4. **비전 자기수정 루프**: LLM-as-aesthetic-judge로 의도 충족까지 반복.

### 3.3 평가 설계

**Table 1 — 통제 지표 (vs gpt-image-2 직접 생성)**

| 문제 | 지표 | 기대 결과 |
| :--- | :--- | :--- |
| 브랜드 일관성 | 지정 HEX와의 색차 ΔE, 폰트 일치율 | 오버레이=0오차 |
| 편집성 | 1글자 수정 시간·재생성 횟수 | 즉시 편집 |
| 재현성 | 동일 입력 N회 결과 분산 | 타이포 결정적 |
| 의도 정합 | CLIPScore(의도텍스트↔결과) | 우위 |

**사용자 스터디 (HCI 논문의 핵심)**

- 비전공자/소상공인 N명, within-subject. 조건 A=Canva, B=gpt-image-2 직접, C=IntentCard.
- 측정: 완성 시간, 의도 충실도(본인+제3자 평가), 만족도(SUS/NASA-TLX), 수정 횟수,
  "이게 내가 원한 것" 동의율.
- 가설: C가 완성 효율·의도 충실도에서 유의하게 우수.

---

## 4. 관련 연구 (인용 후보)

- **RALF** — Retrieval-Augmented Layout Transformer, CVPR 2024 (검색기반 생성; 우리 RAG의 학술 근거)
- **PosterLayout** — content-aware visual-textual layout 벤치마크/지표, 2023
- **CGL-GAN / PDA-GAN** — image-aware 레이아웃 배치(소실영역 회피); 향후 레이아웃 자동화 시
- **CLIP** — Radford et al., ICML 2021 (임베딩 검색 + CLIPScore 평가)
- **GlyphControl / TextDiffuser / AnyText** — 생성 이미지 텍스트 렌더링 (우리 대비 baseline)
- **SEGA** — content-aware layout generation, ICCV 2025 (최신 baseline)
- 디자인 자동화/생성형 디자인 도구의 HCI 연구 (CHI/UIST 계열) — 추후 보강

> 원칙: 온라인 강의(패스트캠퍼스 등)는 **스킬 습득용**이며 논문 인용/콘텐츠 소스 아님.
> 위 1차 논문만 인용한다.

---

## 5. 로드맵 / 다음 작업

- [ ] 본 문서를 기준으로 **Intro·Contribution 1쪽 풀어쓰기**
- [ ] 통제 지표(Table 1) **측정 스크립트** 작성 (ΔE, 폰트 일치, 재현성 분산)
- [ ] 사용자 스터디 프로토콜·IRB·태스크 설계
- [ ] baseline 재현 (Canva 수동 / gpt-image-2 직접 프롬프트)
- [ ] **(보류)** RAG 배포(Railway pgvector) 안정화 — 개발 난이도 높아 후순위
- [ ] 관련 연구 정독 + bib 정리

## 6. 정직한 리스크

- CVPR(비전 알고리즘)에는 부적합 — **HCI(시스템+사용자스터디)** 가 맞는 자리.
- "의도 충실도"의 조작적 정의가 약하면 리뷰 취약 → 구조화 속성 + 사람 평가로 보강 필수.
- gpt-image-2가 품질이 좋으므로 **품질이 아닌 통제(control)** 로 경쟁 프레임을 유지할 것.
