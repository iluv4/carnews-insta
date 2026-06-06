# 카드 생성 아키텍처 비교 — 현재(배포본) vs 본 PR

> 이 PR은 **카드 렌더링을 서버 측 무거운 방식(헤드리스 Chromium / 이미지 생성)에서
> 클라이언트 측 결정론 합성(Fabric.js)으로 교체**합니다. 부가 기능(인증·네이버
> 사진·장소검색·Amazon 생성·공유)은 건드리지 않습니다.

## 0. 한 줄 요약

- **현재**: "AI가 픽셀을 그린다" — 서버에서 Chromium 스크린샷 / OpenAI 이미지 생성 (느림·비쌈·크래시)
- **본 PR**: "AI는 설계도+카피만 만들고, 픽셀은 브라우저가 그린다" — 결정론 코드로 JSON 스펙 생성 → 클라 Fabric.js 렌더 (빠름·쌈·견고)

## 1. 왜 느린가 (현재 배포본 진단)

배포본(`origin/master`)에는 느린 생성 경로가 **3개** 공존합니다:

| 경로 | 방식 | 비용/지연 |
|---|---|---|
| `api/transform` | OpenAI `image_generation` 툴 (diffusion) | `maxDuration=120`, 수십 초 |
| `api/render-card` | 헤드리스 **Chromium 스크린샷** | 카드마다 브라우저 기동/종료, `networkidle0` + 구글폰트 CDN 대기 |
| `services/aiService` | `gpt-image-2` 이미지 생성 | 60–120초 |

- `render-card`는 카드 1장마다 `puppeteer.launch()`→`close()`로 **브라우저를 재사용하지 않음**.
- Railway에서 Chromium은 메모리 폭증·크래시를 유발 → 최근 `#16 crashpad`, `#17 XDG` 커밋이 이를 수습하던 작업.

## 2. 본 PR의 접근 — 결정론 합성 + 클라이언트 렌더

```
analyze (OpenAI gpt-4.1-mini vision)
   → LayoutTemplate JSON  (slides·palette·typography — 구조화 도면)
transform (SSE, 슬라이드 병렬)
   → 피사체 1회 분석(공유) + 슬라이드별 카피
   → buildFabricSpec()  ← 순수 함수, 외부 호출 0
   → FabricSpec JSON 스트리밍
CardCanvas (클라이언트)
   → Fabric.js로 스펙 렌더 → PNG    ← 서버 픽셀 렌더 0
```

## 3. 정량 비교

| 항목 | 현재 (배포본) | 본 PR |
|---|---|---|
| E2E 지연 | 수십 초 ~ 2분 | ~2–5초 |
| 카드당 외부 비용 | diffusion $0.04+ / Chromium 연산 | 텍스트 토큰만 |
| 카드 렌더 주체 | 서버(Chromium/diffusion) | 클라이언트(Fabric.js) |
| 텍스트 | 픽셀로 구워짐(수정 불가, 한글 깨짐 위험) | 진짜 텍스트 객체(편집 가능, 한글 정상) |
| 안정성 | Chromium OOM/crashpad 크래시(#16/#17) | 카드 경로에서 Chromium 미사용 |

## 4. 변경 파일

- **신규**: `src/lib/fabricSpec.ts`, `src/components/CardCanvas.tsx`
- **재작성**: `src/app/api/analyze/route.ts`(→ LayoutTemplate 출력), `src/app/api/transform/route.ts`(→ 카피+spec SSE, 이미지 생성 제거)
- **수정**: `src/components/CardGenerator.tsx`(`/api/transform` 소비 → `<CardCanvas>` 렌더)

## 5. 비파괴/호환 설계

- 기존 템플릿(구 "Design DNA JSONL") 입력 시 `transform`의 `parseLayout`이 `fallbackLayout`으로 **graceful 폴백**.
- analyze 캐시는 `layout:` 네임스페이스로 분리 → 기존 DNA 캐시와 충돌 없음.
- `render-card`·`generate-amazon`·`aiService`는 **그대로 둠**(카드 경로만 전환). `generate-amazon`이 아직 Chromium을 쓰므로 `puppeteer-core`·`@sparticuz/chromium` 의존성과 Dockerfile은 유지.

## 6. 후속 작업 (이 PR 범위 밖)

- 텍스트 LLM을 Gemini 2.5 Flash로 전환(비용·속도 추가 절감) — 별도 PR.
- `generate-amazon`도 마이그레이션 후 Chromium 의존성·Dockerfile 완전 제거.
- 클라 폰트: Pretendard 웹폰트 로딩 보장(`document.fonts.ready` 후 렌더) — 한글 자형 품질.
- 구 `render-card`/`aiService`(gpt-image-2) 제거.

## 7. 검증 상태

- 로컬 빌드/타입체크 기준으로 작성. **Draft PR** — 한현민님 환경에서 적용·QA 후 머지 권장.
