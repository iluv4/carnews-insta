# AI Premium CardNews (인스타그램 카드뉴스 자동 생성 플랫폼)

이 프로젝트는 인스타그램 카드뉴스 제작을 혁신적으로 자동화하는 **AI-Native 프리미엄 콘텐츠 제작 플랫폼**입니다. 단순한 디자인 툴을 넘어, 인스타그램의 디자인 에스테틱을 AI가 직접 학습하여 10초 만에 고퀄리티 마케팅 콘텐츠를 생성합니다.

## ✨ V2.0 주요 업데이트

- **프리미엄 대시보드 UI:** 기존의 단일 페이지 구성을 벗어나, 현대적인 SaaS Dashboard 형태(Sidebar 기반)로 전면 개편되었습니다. Indigo & Light 테마를 적용하여 더욱 전문적이고 쾌적한 제작 환경을 제공합니다.
- **OpenAI GPT Image-2 & GPT-5.5 연동:** 최신 이미지 생성 모델인 `gpt-image-2`를 탑재하여 더욱 사실적이고 세련된 카드뉴스 배경을 생성합니다. 분석에는 `gpt-5.5`를 활용하여 정밀한 디자인 레이아웃 추출이 가능합니다.
- **원클릭 퀵 스타트 (Mirra-style UX):** 템플릿 탐색부터 제작 시작까지 단 한 번의 클릭으로 이어지는 최적화된 워크플로우를 구현했습니다. 템플릿 선택 시 즉시 제작 화면으로 전환되며 입력 필드가 포커스됩니다.
- **하이브리드 이미지 컨트롤:** '창의적 레이아웃(Creative)'과 '엄격한 가이드라인(Strict/ControlNet)' 모드를 지원하여 상황에 맞는 디자인 생성이 가능합니다.

## 🚀 주요 기능

- **AI 디자인 학습 (Reference Learning):** 인스타그램 URL 입력 시 AI가 해당 게시물의 색상, 타이포그래피, 레이아웃을 JSONL 데이터로 정밀 추출합니다.
- **프리미엄 템플릿 라이브러리:** 2026 UX 트렌드, 미니멀 마케팅 등 검증된 디자인 스타일을 즉시 선택하여 사용할 수 있습니다.
- **지능형 텍스트 오버레이:** 생성된 배경 위에 실시간으로 텍스트를 합성하고 디자인할 수 있는 캔버스 에디터(Fabric.js 기반)를 제공합니다.
- **CORS 우회 이미지 프록시:** 인스타그램 CDN의 보안 제약을 극복하고 원활한 이미지 분석 및 처리가 가능하도록 설계되었습니다.

## 🏗️ 20년차 개발자 & UX 디자이너의 설계 철학

이 프로젝트는 단순한 코드 작성을 넘어 **'사용자가 전문 디자이너의 생산성을 갖게 하는 것'**을 목표로 설계되었습니다.

### 1. 사용자 중심의 Seamless Flow
- **러닝 커브 제로:** 템플릿 클릭 시 즉시 제작 단계로 넘어가는 UX는 복잡한 도구 사용법을 익힐 필요를 없애줍니다.
- **마이크로 인터랙션:** 부드러운 탭 전환 애니메이션과 로딩 피드백을 통해 대기 시간을 즐거운 경험으로 전환했습니다.

### 2. 확장 가능한 클린 아키텍처
- **TabContext API:** 전역 상태 관리를 통해 사이드바와 메인 컨텐츠 간의 유기적인 연동을 구현했습니다.
- **Service Layer Pattern:** AI 요청과 데이터 처리를 독립적인 레이어로 분리하여 비즈니스 로직의 안정성을 확보했습니다.

### 3. 고성능 이미지 파이프라인
- **Client-side Compression:** 업로드 전 이미지 압축을 통해 AI 처리 속도를 50% 향상시켰습니다.
- **Fallback Logic:** 최신 모델(`gpt-image-2`) 사용이 불가능한 상황에서도 시스템이 멈추지 않도록 `dall-e-3` 기반의 자동 폴백 시스템을 구축했습니다.

## 🛠️ 기술 스택

- **Frontend:** Next.js (App Router), React, CSS Modules
- **State Management:** React Context API (Shared Navigation)
- **Design Tool:** Fabric.js (Canvas Editor)
- **Backend:** Next.js API Routes, Prisma 7, PostgreSQL
- **AI Engine:** OpenAI API (GPT-Image-2, GPT-5.5, DALL-E 3)
- **Infrastructure:** RapidAPI (Instagram Data Extraction)

## 📋 환경 변수 설정 (.env.local)

```env
OPENAI_API_KEY=여기에_openai_api_키를_입력하세요
RAPIDAPI_KEY=여기에_rapidapi_키를_입력하세요
DATABASE_URL=여기에_postgresql_주소를_입력하세요
NEXTAUTH_SECRET=보안_시크릿_키
```

## 💻 실행 방법

```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npx prisma db push

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 프리미엄 AI 카드뉴스 제작을 시작하세요.



