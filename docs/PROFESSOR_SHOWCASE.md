# 🎓 AI 카드뉴스 생성 시스템 — 발표·어필 자료

> **한 줄 정의**
> "LLM API를 호출하는 앱"이 아니라, **검색(RAG)으로 근거를 대고 · 비전 모델이
> 결과를 채점해 스스로 고치는(self-correcting) · 상태 그래프(LangGraph) 기반
> 멀티에이전트 시스템**입니다. 생성 모델의 고질병(한글 깨짐, 1-pass 품질 편차,
> 환각)을 **아키텍처 차원에서 구조적으로 제거**한 것이 핵심 기여입니다.

이 문서는 발표/면담에서 그대로 말할 수 있도록 ① 무엇을 만들었나 ② 왜 학술적으로
의미 있나 ③ 교수님 예상 질문 방어 순서로 정리했습니다.

---

## 1. 핵심 어필 포인트 5가지 (이것만 기억하면 됨)

| # | 한 문장 | 매핑되는 AI 개념 | 근거 코드 |
|---|---------|------------------|-----------|
| ① | 단방향 파이프라인이 아니라 **사이클(피드백 루프)을 가진 상태 그래프**다 | Agentic workflow / cyclic graph | `agent-service/app/graph.py` |
| ② | 모델의 사전지식이 아니라 **실제 사람이 만든 45개 디자인을 벡터 검색**해 근거로 쓴다 | RAG (retrieval-grounded generation) | `agent-service/app/rag/store.py`, `nodes/retriever.py` |
| ③ | **비전 모델이 결과를 루브릭으로 채점**하고, 점수가 기준 미달이면 다시 만든다 | LLM-as-a-judge / self-refine | `nodes/art_director.py`, `nodes/reviser.py` |
| ④ | 자유형 텍스트 → **JSON Schema strict 강제 정보추출(IE)** 로 결정적 구조 데이터화 | Structured generation / Information Extraction | `src/lib/extract.ts` |
| ⑤ | N장 슬라이드를 **병렬 fan-out**으로 동시 생성 (LangGraph `Send`) | Map-reduce / parallel agent dispatch | `graph.py: _dispatch / render_slide / collect` |

> 💡 발표 오프닝 추천: *"기존 카드뉴스 자동화는 'AI가 한 번에 그려준다'였습니다.
> 저는 이걸 **'설계 → 검색 근거 → 생성 → 채점 → 자기수정'의 에이전트 루프**로
> 재설계했고, 그 결과 확산모델이 한글을 굽다 깨뜨리는 문제와 1-pass 품질 편차를
> 구조적으로 없앴습니다."*

---

## 2. 시스템 아키텍처 (그림으로 설명하기)

### 2.1 두 개의 서비스, 책임 분리

```
┌──────────────────────────┐      SSE / HTTP       ┌───────────────────────────────┐
│        Next.js app       │ ───────────────────►  │   agent-service (Python)      │
│  UI · Auth · Prisma · DB │ ◄───────────────────  │   FastAPI + LangGraph         │
│  Fabric.js 캔버스 렌더   │   node-by-node 이벤트  │   오케스트레이션 "두뇌"       │
└──────────────────────────┘                       └───────────────────────────────┘
            │                                                     │
            ▼                                                     ▼
     Postgres (Neon) ◄────── 공유 ──────────────────►   pgvector 인덱스 (RAG)
```

- **웹(표현·영속)** 과 **에이전트(AI 오케스트레이션)** 를 분리 → 각 서비스가 한
  가지 책임만. Next.js 라우트는 SSE 패스스루(`api/agent-generate`)일 뿐.
- 발표 포인트: *"AI 로직을 UI에서 분리해 독립 배포·독립 스케일·독립 테스트가
  가능한 마이크로서비스로 뺐습니다."*

### 2.2 에이전트 그래프 (LangGraph `StateGraph`)

```
planner → retriever → copywriter ─┬─▶ render_slide ─┐
                                  ├─▶ render_slide ─┼─▶ collect → END
                                  └─▶ render_slide ─┘
                                     (슬라이드마다 1 브랜치, 병렬)

  각 render_slide 내부:
     designer → image_gen → art_director(비전 채점)
                                 │
                                 ▼   score < threshold ?
                              reviser ──(yes, loop)──► designer
                                 │
                                (no) → 카드 확정
```

1. **planner** — 주제를 슬라이드별 역할/의도로 분해
2. **retriever (RAG)** — 주제를 임베딩 → 45개 실제 템플릿 중 top-k 코사인 검색
3. **copywriter** — 검색된 예시의 톤에 맞춰 슬라이드 카피 작성
4. **designer** — 이미지 모델용 아트디렉션 프롬프트 구성 (이전 루프의 수정노트 반영)
5. **image_gen** — 글자 없는 **배경** 생성 (한글은 나중에 CSS 오버레이)
6. **art_director (비전 critic)** — 결과를 루브릭으로 0~10 채점 + 구체적 수정안 도출
7. **reviser** — 수정안을 지시문으로 바꿔 designer로 **루프백**
   → 점수가 임계값(`AGENT_QUALITY_THRESHOLD`)을 넘거나 최대 반복수에 도달할 때 종료

---

## 3. "왜 이게 단순 프롬프트 체인이 아닌가" (교수님이 가장 궁금해할 지점)

발표에서 이 세 가지를 명확히 하면 "그냥 ChatGPT 호출 아니냐"는 반론을 원천 차단합니다.

### 3.1 사이클이 있다 (그래프 ≠ 파이프라인)
`art_director → reviser → designer`는 **피드백 루프**입니다. 일반 파이프라인은
표현할 수 없는 구조이고, LangGraph는 이걸 *상태 + 조건부 엣지 + 반복 횟수 제한*
으로 1급 객체처럼 다룹니다. → **"상태기계로서의 에이전트"** 라는 점이 핵심.

### 3.2 검색으로 근거를 댄다 (RAG)
기존 `/api/match`는 템플릿의 **이름만** 모델에 주고 "알아서 골라봐"였습니다(=환각
유발). 새 retriever는 **실제 디자인 내용**을 임베딩해 코사인 유사도로 랭킹 →
진짜 retrieval. *모델의 prior가 아니라 사람이 만든 레퍼런스에 grounding* 합니다.

### 3.3 스스로 평가한다 (LLM-as-a-judge)
비전 critic이 루브릭(가독성/대비, 위계, 한글 타이포, 여백 확보, 아티팩트)으로
**점수를 매겨** 루프를 닫습니다. 품질이 *가정*이 아니라 *측정*됩니다.

> 핵심 멘트: *"생성형 시스템의 품질을 '잘 나오겠지'가 아니라 **루브릭 기반으로
> 정량 채점**하고, 그 점수를 종료 조건으로 쓰는 평가 내재화(eval-in-the-loop)를
> 구현했습니다."*

---

## 4. 엔지니어링 성숙도 신호 (디테일에서 점수 따기)

교수님은 "개념을 아는가"뿐 아니라 "**제대로 만들었는가**"를 봅니다. 아래는 실무
성숙도를 보여주는 디테일들입니다.

### 4.1 3단 우아한 성능저하(graceful degradation) — RAG
`rag/store.py`는 키/인프라 가용성에 따라 자동 하강합니다:
1. **pgvector + DATABASE_URL** 있으면 → DB에 임베딩 영속/질의
2. 없으면 → **in-process numpy 인덱스** (startup 시 구축)
3. OpenAI 키조차 없으면 → **어휘 기반(토큰 + 한글 bigram) 폴백**
   - 한글은 띄어쓰기 형태소가 없어서 **문자 bigram**으로 신호 확보 (예: "흑돼지"↔"돼지"가 bigram 공유)

→ **키 하나 없이도 그래프가 end-to-end로 돈다** = CI/오프라인 데모/테스트 가능.

### 4.2 추론 모델 파라미터 호환 shim
`agent-service/app/models.py`: GPT-5 계열·o-시리즈는 `max_tokens`를 거부하고
`max_completion_tokens`를 요구하며, 숨은 reasoning 토큰을 예산에서 소모합니다.
이걸 감지해 모델별 올바른 파라미터(+`reasoning_effort`)를 자동 주입 →
*"모델 세대가 바뀌어도 안 깨지는 추상화"*.

### 4.3 모델 레지스트리 중앙화
라우트마다 흩어져 하드코딩되던 모델명을 `src/lib/models.ts` 한 곳으로 통합,
env로 태스크별 재정의(`OPENAI_VISION_MODEL` 등). *어떤 스냅샷에도 hard-pin 안 함*
→ deprecation 내성.

### 4.4 한글 타이포 문제의 "구조적" 해결
확산모델이 한글을 픽셀로 구우면 헛글자가 생깁니다. 해결책: **배경엔 글자를 절대
넣지 않고**, 한국어 카피는 브라우저에서 **진짜 텍스트 객체(CSS/Fabric.js)** 로
오버레이. → 편집 가능 + 한글 자형 정상. critic 루브릭도 "이미지에 글자 보이면
감점"으로 이 불변식을 강제합니다. *문제를 프롬프트로 달래는 게 아니라 파이프라인
구조로 제거*한 사례.

### 4.5 병렬 fan-out으로 지연 상수화
N장 슬라이드를 LangGraph `Send` API로 동시 디스패치 → N장 덱이 카드 1장의
벽시계 시간에 근접. `collect`가 순서대로 fan-in. (map-reduce 패턴)

---

## 5. 정보추출(IE) 파이프라인 — 별도 어필 항목

`src/lib/extract.ts` (`/api/extract`): 뉴스 URL/텍스트 → 카드 브리프(JSON).

```
load (URL이면 cheerio로 본문/메타 추출) → clean (보일러플레이트 제거·토큰 절약)
   → extract (OpenAI structured outputs, JSON Schema strict 강제)
   → verify (스키마 후처리·슬라이드 수 정합성 보정)
```

- **JSON Schema strict**로 출력 형식을 모델이 어길 수 없게 강제 (headline,
  key_points 3~6개, entities[name/type], tone enum, slides[role/title/body]).
- 자유형 텍스트 → **결정적 구조 데이터** 변환. 이 출력이 레이아웃 컴포지터의
  입력으로 바로 연결됨 = 모듈 간 계약(contract)이 타입으로 보장됨.
- 발표 포인트: *"NER(entities) + 분류(tone) + 요약(summary) + 구조화 분할(slides)
  을 한 번의 structured extraction으로 묶은 IE 파이프라인."*

---

## 6. 데이터 분석 트랙 (시계열 과목용, 보너스 어필)

`analysis/` — 모니터링한 인스타 레퍼런스 계정의 인게이지먼트 **불규칙 시계열** 분석.
- **MAD z-score** 기반 강건한 이상치/바이럴 스파이크 탐지
- 콘텐츠 포맷별 효과(photo > reel > carousel), 도달↔인게이지먼트 **Pearson r=0.73**
- 게시 시간대 효과 분석 + 3-post 이동평균
- 확장 경로: `next_max_id` 페이지네이션으로 표본 늘려 SARIMA 계절성 예측

> ⚠️ 보안 메모(정직성 신호로 언급하면 좋음): 분석 README에 "개발 중 RapidAPI 키가
> 평문 노출됐으니 로테이션 필요"가 명시돼 있음 — 발표에서 *"운영 보안까지 체크리스트로
> 관리한다"*는 근거로 활용 가능.

---

## 7. 기술 스택 (한 슬라이드용)

- **Web**: Next.js 16 (App Router), React 19, Fabric.js 캔버스 렌더
- **Agent**: FastAPI, **LangGraph** (상태 그래프 + critique→revision 루프)
- **DB**: Prisma 7, PostgreSQL(Neon) + **pgvector** (RAG 검색)
- **AI 모델(2026-06)**: GPT-5.5(추론/카피/비전), GPT-5.2(비전 critic),
  gpt-image-2(배경 생성), text-embedding-3-large(임베딩) — *전부 env 재정의 가능*
- **배포/인프라**: Vercel · Railway · Docker(멀티스테이지) · GitHub Actions

---

## 8. 🛡️ 예상 질문 방어 (Q&A 시뮬레이션)

발표 후 질의응답에서 나올 법한 질문과 모범 답변입니다.

**Q1. "그냥 OpenAI API 호출하는 거 아닌가요?"**
A. 단일 호출이면 사이클·검색·평가가 필요 없습니다. 제 시스템은 ①비전 critic의
점수가 종료조건인 **피드백 루프**, ②실제 디자인을 임베딩 검색하는 **RAG**, ③슬라이드
**병렬 fan-out** 세 가지를 가집니다. 이건 단일 호출로는 표현 불가능한 구조입니다.
(graph.py를 띄워 사이클 보여주기)

**Q2. "RAG라고 했는데 진짜 벡터 검색인가요, 키워드 매칭인가요?"**
A. 기본 경로는 `text-embedding-3-large` 임베딩 + 코사인 유사도(pgvector 또는
numpy)입니다. 키가 없는 개발 환경을 위해 **어휘 폴백**도 두긴 했지만, 그건 graceful
degradation용이고 운영 경로는 dense retrieval입니다. (store.py의 3단 하강 설명)

**Q3. "비전 critic의 점수를 신뢰할 수 있나요? LLM이 채점을 잘하나요?"**
A. 그래서 **자유 채점이 아니라 고정 루브릭**(가독성/위계/여백/아티팩트/한글)으로
제약하고, JSON 스키마로 점수+근거+수정안을 강제 출력시킵니다. 또한 점수를 절대
신뢰하지 않도록 **최대 반복 횟수 상한**을 둬서 무한루프/over-fitting을 막습니다.
한계는 인정하되, "측정 안 함"보다 "불완전하게라도 측정"이 낫다는 입장입니다.

**Q4. "왜 한글을 이미지에 안 굽고 따로 오버레이하나요?"**
A. 확산모델은 한글 자형을 자주 깨뜨립니다(헛글자). 프롬프트로 달래는 건 확률적
미봉책이라, **배경에 글자를 0개로 강제**하고 텍스트를 진짜 객체로 얹어 *결정적으로*
해결했습니다. critic 루브릭도 "글자 보이면 감점"으로 이 불변식을 지킵니다.

**Q5. "평가(eval)는 어떻게 했나요? 정량 지표가 있나요?"**
A. ①critic 루브릭 점수가 in-the-loop 품질 지표이고, ②아키텍처 비교 문서에
E2E 지연(수십초~2분 → 2~5초)·카드당 비용(diffusion $0.04+ → 텍스트 토큰만)
정량 비교가 있습니다. ③향후 작업으로 **골든셋 기반 오프라인 eval**(사람 라벨 vs
critic 점수 상관)을 로드맵에 두고 있습니다. (정직하게 한계도 제시)

**Q6. "테스트는 있나요?"**
A. `agent-service/tests/test_graph.py`가 **키 없이** 그래프 노드 실행 순서와
fan-out/fan-in을 검증합니다. graceful degradation 덕에 CI에서 외부 호출 없이
end-to-end가 돌아갑니다.

**Q7. "한계와 다음 단계는?"** (이걸 먼저 말하면 성숙해 보임)
A. ①critic 점수의 오프라인 검증(골든셋) 미비, ②RAG 코퍼스가 45개로 작음(확장
필요), ③비용/지연을 줄일 모델 라우팅(쉬운 카드는 저렴 모델) 미적용.
로드맵: `docs/AI_ENGINEER_GAP_ROADMAP.md`에 LangGraph화·OCR/IE·HF 파인튜닝·
클라우드 서빙·MLOps 단계별 계획을 명시.

---

## 9. 정직성 원칙 (이게 오히려 신뢰를 만듦)

- 과장하지 않습니다. 모든 주장은 **코드·배포·문서로 추적 가능**합니다(위 표의 근거 컬럼).
- 폴백/한계를 숨기지 않고 *설계 의도*로 설명합니다(graceful degradation, eval 미비).
- "기획자가 만든 서비스"가 아니라 **"AI 시스템을 설계·구현·배포한 엔지니어"** 로
  서술합니다 (`AI_ENGINEER_GAP_ROADMAP.md` §0).

---

## 10. 발표 90초 스크립트 (그대로 읽어도 됨)

> "안녕하세요. 저는 카드뉴스 생성을 단일 AI 호출이 아니라 **에이전트 시스템**으로
> 재설계했습니다. 핵심은 셋입니다. 첫째, 사람이 만든 45개 실제 디자인을 **벡터
> 검색(RAG)** 해 생성의 근거로 댑니다. 둘째, 만든 결과를 **비전 모델이 루브릭으로
> 채점**하고, 기준 미달이면 수정안을 받아 **다시 만드는 자기수정 루프**를
> LangGraph 상태 그래프로 구현했습니다. 셋째, 한글이 깨지는 확산모델의 한계를
> 프롬프트가 아니라 **'배경엔 글자 0개, 텍스트는 진짜 객체로 오버레이'라는 구조**로
> 제거했습니다. 여기에 슬라이드 병렬 생성, 키 없이도 도는 3단 폴백, 모델 세대
> 호환 추상화까지 엔지니어링 성숙도를 갖췄습니다. 한계도 분명합니다 — critic
> 점수의 오프라인 검증과 RAG 코퍼스 확장이 다음 과제입니다. 감사합니다."

---

*근거 파일 빠른 참조: `agent-service/app/graph.py` · `rag/store.py` ·
`nodes/{retriever,art_director,reviser}.py` · `src/lib/extract.ts` ·
`docs/AGENT_ARCHITECTURE.md` · `docs/ARCHITECTURE_COMPARISON.md` ·
`docs/AI_ENGINEER_GAP_ROADMAP.md` · `analysis/`*
