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
- **자기수정 루프**: `ocr_gate`(글자 정확도) + `art_director`(GPT-5.5 비전, 미감) 비평
  → `reviser` → 재생성으로, **두 점수**가 모두 임계값을 넘을 때까지 카드를 다시 만듭니다.
  (단방향 1패스 → 피드백 루프)
- **텍스트 박기(baked-in) + OCR 게이트**: `gpt-image-2`가 한국어 카피를 **이미지 안에 직접 렌더링**해 *발행 가능한 완성 카드*를 만듭니다. 글자가 깨질 위험은 `ocr_gate` 노드(렌더된 글자를 OCR로 읽어 원본 카피와 diff)로 검증하고, 통과할 때까지 자동 재생성합니다. (오버레이/레이어 후작업 없이 완성품을 주는 MVP 전략 — 결정 과정은 아래 [개발 일지](#개발-일지-dev-log) 참고)

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

## 개발 일지 (Dev Log)

> 이 프로젝트가 어떻게 **왔다갔다 하며** 지금에 이르렀는지를 날짜순으로 기록합니다.
> 핵심 줄거리는 하나입니다 — **"한국어 텍스트를 이미지에 굽느냐(박기), 레이어로 얹느냐(오버레이)"** 를
> 두고 오간 끝에, MVP는 **박기 + OCR 게이트**로 결론.

### 1일차 — 2026-05-05~07 · V2: "레퍼런스 학습형" 카드 생성기
- 인스타 프로필/URL에서 이미지를 긁어와 GPT Vision으로 레퍼런스를 분석하고(`/api/analyze`),
  테마로 템플릿을 고르고(`/api/match`), 카드를 뽑는 **단방향 1패스** 파이프라인.
- 이 시기의 텍스트 전략은 **오버레이** — `gpt-image-2`로 배경을 만들고 글자는 따로 얹음.
- 비용/인프라와 씨름: `gpt-4.1-mini` 다운그레이드, JPEG·quality medium, Puppeteer→직접 HTTP,
  네이버 지도 사진 수집, 모바일 최적화. *(이 과정에서 랜딩페이지는 두 번 revert — 첫 "왔다갔다")*

### 2일차 — 2026-05-25 · "편집 가능한 레이어 문서" 파이프라인 (Phase 1)
- 완성품을 주는 대신 **편집 가능한 레이어**(COLE 스타일)를 생성하는 방향으로 선회.
  드래그 이동·폰트·색 편집이 되는 클라이언트 레이어 에디터, AI 배경은 **글자 없이** 생성하고
  텍스트 레이어는 분리해 유지. Redis 잡 스토어, 클라이언트 사이드 렌더.
- 즉, **"오버레이/레이어"** 노선을 더 깊게 밀어붙인 시기. (Figma 같은 후작업을 전제)

### 3일차 — 2026-06 초 · 에이전트화(RAG + LangGraph) & 박기↔오버레이 진동
- `/api/match`의 "이름만 보고 추측"을 **진짜 RAG**(45개 실제 템플릿 임베딩 검색)로 교체.
- 단방향 1패스를 **자기수정 루프**로: `art_director`(비전 비평) → `reviser` → 재생성.
  → 별도 Python `agent-service`(FastAPI + **LangGraph** `StateGraph`)로 두뇌 분리.
- 모델 레지스트리 통합 + 플래그십 `gpt-5.5` 상향.
- 이 시점 코드가 다시 **오버레이로 회귀**(commit *"한국어 텍스트 굽기 제거 → 또렷한 타이포
  오버레이"*) — 확산 모델이 한글을 구우면 헛글자가 난다는 실전 이슈 때문. *(박기↔오버레이 2차 왕복)*

### 4일차 — 2026-06-13 · 결론: **박기 올인 + OCR 게이트** (현재)
- 제품 판단: 초보자 타깃 MVP에는 **레이어 후작업이 오히려 진입장벽**. 발행 가능한 완성품을 줘야 한다.
  → 텍스트를 **이미지에 직접 굽는(baked-in) 박기 올인**으로 최종 결정.
- 박기의 유일한 리스크(=한글 깨짐)를 막기 위해, 핸드오프 설계의 **필수 기둥인 OCR diff 게이트를
  LangGraph 노드로 신설**: `image_gen → ocr_gate → art_director`. 렌더된 글자를 OCR로 읽어
  원본 카피와 `difflib`로 diff하고, 숫자·날짜·URL은 한 글자만 틀려도 탈락 → 통과까지 재생성.
- `designer`는 "글자 없는 배경"에서 "정확한 카피를 굽는 카드"로, `art_director`는 "글자 있으면
  감점"에서 "글자가 정확히 박혔는지 검증"으로 **뒤집음**. 루프는 이제 **글자 정확도 + 미감** 두
  점수를 모두 통과해야 종료.
- 클라이언트(`agent-demo`)는 박힌 이미지를 **그대로** 표시(이중 텍스트 제거). 기존 Fabric.js
  캔버스 에디터는 파워유저 후편집용으로 잔존.

> **다음 단계(고객 반응 보며 고도화):** ① `style_gate` — 렌더 카드와 검색 예시의 CLIP 이미지
> 임베딩 코사인 유사도로 *세트 전체의 톤 일관성* 게이트(세 번째 점수). ② **골든셋** 20~30장으로
> 심판(`art_director`) 점수가 사람 판단과 일치하는지 주기 검증하는 오프라인 eval 하니스.
> 둘 다 설계·근거는 [`docs/AGENT_ARCHITECTURE.md`](docs/AGENT_ARCHITECTURE.md) 참고.

---

## 👨‍💻 Team Collaboration
팀원들과 실시간으로 공유하고 싶은 내용이나, 기술적 문의 사항은 언제든 리포트의 **Future Roadmap** 섹션을 업데이트하거나 담당 개발자에게 문의해 주세요.

**"우리는 디자인의 장벽을 허물고 누구나 크리에이터가 되는 세상을 만듭니다."**
