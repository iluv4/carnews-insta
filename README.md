# 🚀 AI CardNews Insta: Korea's Canva Project

> **인스타그램 스타일을 학습하여 10초 만에 고퀄리티 카드뉴스를 생성하는 프리미엄 SaaS 플랫폼**

| Status | Version | Environment | Last Update |
| :--- | :--- | :--- | :--- |
| `✅ Stable` | `v2.2.0` | `Production (Vercel)` | 2026-05-05 |

---

## 💎 Project Overview
본 프로젝트는 단순한 자동화 도구를 넘어, **AI가 디자인 미학(Aesthetics)을 학습**하여 전문가 수준의 콘텐츠를 생산하는 것을 목표로 합니다. 사용자가 제공하는 레퍼런스의 '디자인 DNA'를 분석하고 복제하여, 브랜드 일관성을 유지하면서도 압도적인 시각적 퀄리티를 보장합니다.

---

## 🏆 Key Accomplishments (V3 — Agentic Update)

### 1. RAG + 멀티에이전트 생성 파이프라인 (LangGraph)
- **검색 기반 생성(RAG)**: 저장된 45개 실제 인스타 템플릿을 임베딩해 주제와 유사한
  디자인을 검색하고, 그 결과를 카피/디자인 생성의 few-shot 근거로 사용합니다.
  (기존 `/api/match`의 "이름만 보고 추측"을 실제 벡터 검색으로 대체)
- **자기수정 루프**: `art_director`(GPT-5.5 비전) 비평 → `reviser` → 재생성으로,
  품질 점수가 임계값을 넘을 때까지 카드를 다시 만듭니다. (단방향 1패스 → 피드백 루프)
- **배경 생성 + 타이포 오버레이**: `gpt-image-2`로 **글자 없는 배경**을 생성하고, 한국어 카피는 브라우저에서 또렷한 CSS 타이포로 얹습니다. (확산 모델이 한글을 구우면 헛글자가 생기는 문제를 구조적으로 제거)

### 2. "Wowed" UX: Instant Quick Test
- **One-Click Magic**: 업종별 추천 버튼 클릭 시 URL 입력부터 이미지 추출까지 **즉시 실행**.
- **Real-time Reference**: 사용자가 분석할 이미지를 고르는 단계까지의 시간을 70% 단축하여 "빠름 그 이상의 경험" 제공.

### 3. Canvas Editor V2.1 (Professional Grade)
- **Figma-Style UI**: 투박한 버튼을 제거하고 **아이콘 기반의 세련된 플로팅 툴바**로 전면 개편.
- **Enhanced Precision**: 자간, 투명도, 폰트 웨이트 조절 기능을 글래스모피즘 인터페이스로 통합.
- **Smart Handle & Snap**: 피그마와 유사한 정밀 객체 조작 핸들 및 레이아웃 가이드 지원.

---

## 🛠️ Technical Stability & Bug Fixes
> [!IMPORTANT]
> 인프라와 로직의 완벽한 조화를 위해 다음의 핵심 이슈들을 해결했습니다.

- **[Fixed] Prisma 7 & Neon Postgres**: Prisma 7의 새로운 설정 규격에 맞춰 `prisma.config.ts`를 최적화하고, Neon DB와의 연동 안정성 확보.
- **[Fixed] Base64 Image Analysis**: 서버에서 Base64 이미지 문자열을 URL로 오인하여 `fetch` 하려던 치명적 버그 해결.
- **[Fixed] 모델 레지스트리 통합 & 최신 플래그십 적용**: API 라우트마다 흩어져 하드코딩되던 모델명(`gpt-4.1-mini`/`gpt-4o-mini`)을 `src/lib/models.ts` 한 곳으로 통합하고, 기본값을 최신 멀티모달 플래그십 `gpt-5.5`로 상향. reasoning 모델 파라미터 차이(`max_completion_tokens`·`temperature` 미지원)를 호환 shim으로 흡수하여 비전 분석·카피 품질을 끌어올림. (env로 태스크별 재정의 가능)
- **[Fixed] Dynamic UI Update**: 템플릿 선택 시 "적용된 스타일" 배지가 실시간으로 업데이트되지 않던 리액티브 이슈 해결.

---

## 🗺️ Future Roadmap: The "Korean Canva" Vision

### Phase 2: 보관함 및 영속성 (In Progress)
- [x] **Database Schema**: `GeneratedCard` 모델 설계 및 DB 연동 완료.
- [x] **Neon Integration**: Vercel 연동 및 환경 변수 자동화 설정 완료.
- [ ] **Save to Project**: 생성된 카드뉴스를 DB에 영구 저장 및 개인별 갤러리 제공.

### Phase 3: 설정 및 요금제 개편 (Next Step)
- [ ] **Premium Billing UI**: 사용량 대시보드 및 세련된 프라이싱 테이블 구축.
- [ ] **Subscription Model**: 토큰 기반 결제 및 Pro 요금제 전용 기능 잠금 해제.

---

## 🏗️ Architecture & Tech Stack

Two services: the **Next.js web app** (UI · auth · DB · canvas render) and a
**Python `agent-service` (FastAPI + LangGraph)** that runs the RAG + multi-agent
graph. See [`docs/AGENT_ARCHITECTURE.md`](docs/AGENT_ARCHITECTURE.md).

- **Web**: `Next.js 16 (App Router)`, `React 19`, `Fabric.js` canvas renderer
- **Agent service**: `FastAPI`, `LangGraph` (stateful graph with a critique→revision loop)
- **Database**: `Prisma 7`, `PostgreSQL (Neon)` + `pgvector` for RAG retrieval
- **AI Models (2026-06)**: `GPT-5.5` (reasoning/copy/vision — multimodal,
  `reasoning_effort=high` by default for quality-first output),
  `gpt-image-2` (full-card image generation, quality=high), `text-embedding-3-large` (RAG)

> Models are env-overridable on both sides — Next.js routes via
> `OPENAI_VISION_MODEL` / `OPENAI_COPY_MODEL` / `OPENAI_CLASSIFY_MODEL`
> (`src/lib/models.ts`), and the agent service via `AGENT_TEXT_MODEL` /
> `AGENT_VISION_MODEL` / `AGENT_IMAGE_MODEL`. Nothing is hard-pinned to a snapshot.

### 🔍 AI Pipelines (LLM Engineering)
- **`/api/analyze`** — GPT-4o **Vision** 기반 레퍼런스 → 구조화 레이아웃 템플릿(JSON) 추출.
- **`/api/extract`** — 뉴스 URL/텍스트 → **structured outputs(JSON Schema strict)** 로 카드뉴스 브리프를 추출하는 **정보추출(IE) 파이프라인** (`load → clean → extract → verify`). 구현: `src/lib/extract.ts`.
- **`/api/match`** — 테마 기반 최적 디자인 템플릿 선택(LLM 라우팅).

---

## 👨‍💻 Team Collaboration
팀원들과 실시간으로 공유하고 싶은 내용이나, 기술적 문의 사항은 언제든 리포트의 **Future Roadmap** 섹션을 업데이트하거나 담당 개발자에게 문의해 주세요.

**"우리는 디자인의 장벽을 허물고 누구나 크리에이터가 되는 세상을 만듭니다."**
