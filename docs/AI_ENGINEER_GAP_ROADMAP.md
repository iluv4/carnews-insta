# AI 엔지니어 전환 로드맵 — 갭 분석 & 증명 계획

> 채용 요건(JD) 매칭에서 "확인되지 않음"으로 표시된 역량을, **실제로 증명 가능한 산출물**로 메우기 위한 단계별 계획.
> 원칙: *과장하지 않는다. 코드·배포·지표로 증명한다.*

---

## 0. 현재 정체성 재정렬

이력서가 PM/PO·마케팅·콘텐츠 성향과 섞여 **AI/ML 엔지니어 기술 정체성이 분산**되어 보이는 문제.

**조정 방향**
- 상단(Above the fold)에 **엔지니어링 성과**를 먼저 배치 → 비즈니스/콘텐츠 성과는 뒤로.
- 모든 프로젝트를 `문제 → 기술 스택 → 구현 → 운영/지표` 포맷으로 통일.
- "기획자가 만든 서비스"가 아니라 **"AI 시스템을 설계·구현·배포한 엔지니어"**로 서술.

---

## 1. 이미 증명 가능 (지금 바로 전면 배치)

| JD 요건 | carnews-insta 내 실제 근거 | 강조 위치 |
| :-- | :-- | :-- |
| OpenAI API 기반 AI 시스템 구축 | `api/analyze` (GPT-4o Vision → 구조화 JSON), `api/match`, `api/extract`(신규 IE 파이프라인) | 이력서·포트폴리오 최상단 |
| LLM 기반 NLP / 정보추출(IE) | `lib/extract.ts` — structured outputs(JSON Schema strict)로 기사→카드 브리프 추출 | 별도 프로젝트 항목 |
| 클라우드 배포 | Vercel · Railway 운영, 환경변수·DB(Neon) 연동 | 운영 경험 섹션 |
| 컨테이너(Docker) | `Dockerfile` · `docker-entrypoint.sh` 멀티스테이지 빌드 | 인프라 스킬 |
| 비전 LLM / OCR 인접 | 레퍼런스 이미지에서 레이아웃·텍스트 역할 추출(Vision IE) | NLP/IE 항목 |

> 즉시 액션: 위 항목을 "AI 모델·API 연동 / 문서 분석 파이프라인 / 배포·운영"으로 묶어 이력서 상단에 명시.

---

## 2. 진짜 갭 & 증명 미니프로젝트 (4~6주 로드맵)

각 항목은 **작지만 끝까지 배포되는** 미니프로젝트로 증명한다.

### 2.1 LangChain / LangGraph 기반 오케스트레이션 — *Week 1*
- **할 일**: 현재 `lib/extract.ts`의 절차적 파이프라인(load→clean→extract→verify)을 **LangGraph 상태 그래프**로 재구현. 분기(재시도/검증 실패 루프), 도구 호출(검색·요약) 노드 추가.
- **증명물**: `feat: extract 파이프라인을 LangGraph 상태머신으로 전환` PR + 그래프 다이어그램.
- **JD 매칭**: LangChain/LangGraph 활용 AI 시스템 구축.

### 2.2 OCR + 정보추출(IE) 엔드투엔드 — *Week 2*
- **할 일**: 이미지(메뉴판·전단지) → OCR(Tesseract 또는 PaddleOCR / GPT-4o Vision) → 구조화 필드 추출 → 카드뉴스 자동 생성. carnews 제품에 자연스럽게 얹음.
- **증명물**: `/api/ocr-extract` 라우트 + 데모 GIF + 정확도 측정(샘플 N개 정성평가).
- **JD 매칭**: LLM 기반 OCR·정보추출(IE).

### 2.3 PyTorch / Huggingface 학습·실험 — *Week 3*
- **할 일**: 작은 분류/임베딩 태스크 직접 파인튜닝. 예) 한국어 카드뉴스 "톤(tone)" 분류기 — Huggingface `klue/roberta-small` 파인튜닝, 추론을 carnews `extract`의 `tone` 필드 보조에 사용.
- **증명물**: 학습 노트북 + W&B(또는 로컬) 학습 곡선 + Huggingface Hub 모델 카드.
- **JD 매칭**: PyTorch·Huggingface 학습/실험, 데이터 파이프라인.

### 2.4 클라우드 AI 서빙 (AWS/GCP) + MLOps — *Week 4*
- **할 일**: 2.3의 모델을 **FastAPI**로 감싸 **Docker** 이미지화 → AWS(ECS/Lambda) 또는 GCP(Cloud Run) 배포. 간단 CI(GitHub Actions: lint→test→build→deploy).
- **증명물**: 퍼블릭 추론 엔드포인트 + `Dockerfile` + Actions 워크플로 + 부하/지연 측정.
- **JD 매칭**: 클라우드 AI 배포(AWS/GCP), MLOps(FastAPI·Docker), 배포 자동화.

### 2.5 데이터·학습 파이프라인 — *Week 5~6 (선택 심화)*
- **할 일**: 수집(크롤링)→정제→라벨링→학습→평가→재학습 루프를 스케줄러(cron/Cloud Scheduler)로 묶기. 데이터 버전관리(DVC) 도입.
- **증명물**: 파이프라인 다이어그램 + 재현 가능한 `make train` + 평가 리포트.
- **JD 매칭**: 데이터 엔지니어링·학습 파이프라인 구축, Kubernetes(여력 시 GKE/EKS).

---

## 3. 우선순위 (시간 대비 효과)

1. **§1 즉시 재배치** — 비용 0, 효과 최대 (이미 가진 근거를 안 보이게 둔 상태).
2. **§2.1 LangGraph 전환** — 기존 코드 재활용, 키워드 정확 매칭.
3. **§2.2 OCR/IE** — 제품에 바로 얹혀 데모가 강력.
4. **§2.3~2.4 학습+서빙** — "API 사용자"가 아닌 "모델 만드는 엔지니어"로 증명.
5. **§2.5** — 시니어 신호, 여력 시.

---

## 4. 산출물 체크리스트

- [x] `lib/extract.ts` · `/api/extract` — LLM 구조화 정보추출(IE) 파이프라인
- [ ] LangGraph 상태그래프 전환 PR
- [ ] OCR→IE 데모 + 라우트
- [ ] Huggingface 파인튜닝 모델 + 모델카드
- [ ] FastAPI+Docker 클라우드 서빙 엔드포인트
- [ ] CI/CD 워크플로 + 데이터 파이프라인 다이어그램
