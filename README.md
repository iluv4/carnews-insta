# 인스타그램 카드 뉴스 자동 생성기 (Instagram Card News Generator)

인스타그램 카드 뉴스 콘텐츠를 자동으로 아름답게 생성해 주는 Next.js 웹 애플리케이션입니다. 인스타그램 URL에서 이미지 데이터를 추출하고, OpenAI의 GPT-Image-2를 사용하여 입력하신 테마와 스타일에 맞춘 새로운 카드 뉴스 배경 이미지를 생성합니다.

## 주요 기능

- **인스타그램 링크 다중 추출 & 다운로드:** 인스타그램 포스트, 릴스 등의 URL에서 고화질 원본 이미지와 영상을 깔끔하게 추출합니다. 화면에서 추출된 이미지들을 확인하고 바로 개별 다운로드할 수 있습니다. (RapidAPI 연동)
- **GPT-4V 기반 지능형 이미지 분석:** 원본 인스타그램 이미지를 AI가 먼저 분석하여 색상, 분위기, 주요 객체 등의 문맥을 파악합니다.
- **AI 기반 이미지 변환 (선택):** 추출 및 분석된 결과를 바탕으로, OpenAI의 GPT-Image-2를 사용하여 특정 테마와 레퍼런스 스타일에 맞는 카드 뉴스용 배경 이미지로 재생성할 수 있습니다.
- **텍스트 오버레이 및 합성 다운로드:** 생성된 배경 이미지 위에 사용자가 원하는 텍스트(제목, 부제목 등)를 자유롭게 입력하고 색상을 지정할 수 있습니다. 모든 요소가 합성된 최종 카드 뉴스 이미지는 단 한 번의 클릭으로 다운로드됩니다.
- **모던 UI:** Next.js와 React를 기반으로 구축되었으며, 이미지 추출, 다중 선택, 텍스트 오버레이, AI 변환까지 한 화면에서 물 흐르듯 처리할 수 있는 깔끔한 인터페이스를 제공합니다.

## 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/) (App Router)
- **라이브러리:** [React](https://react.dev/)
- **스타일링:** CSS Modules
- **웹 스크래핑:** [Cheerio](https://cheerio.js.org/) & [Axios](https://axios-http.com/)
- **AI 연동:** [OpenAI API](https://platform.openai.com/docs/api-reference) (GPT-Image-2)

## 시작하기 전에 (Prerequisites)

로컬에서 프로젝트를 실행하려면 다음 항목들이 설치되어 있어야 합니다:
- Node.js (v18 이상 권장)
- npm, yarn, pnpm 또는 bun

AI 이미지 생성 기능을 사용하기 위해서는 **OpenAI API Key**가 필요하며, 인스타그램 미디어를 고화질로 스크래핑하기 위해서는 **RapidAPI Key** (`instagram120` API)가 필요합니다.

## 환경 변수 (Environment Variables)

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 발급받은 OpenAI API 키를 추가해 주세요:

```env
OPENAI_API_KEY=여기에_openai_api_키를_입력하세요
RAPIDAPI_KEY=여기에_rapidapi_키를_입력하세요
```
*(API 키들이 제공되지 않을 경우, 애플리케이션은 임시 자리 표시자(placeholder) 이미지로 작동합니다).*

## 실행 방법

1. **의존성 설치:**
   ```bash
   npm install
   # 또는
   yarn install
   ```

2. **개발 서버 실행:**
   ```bash
   npm run dev
   # 또는
   yarn dev
   ```

3. **앱 접속:**
   브라우저에서 [http://localhost:3000](http://localhost:3000) 주소로 접속하면 애플리케이션을 확인할 수 있습니다.

## 🚀 주요 트러블슈팅 및 학습 내용 (Troubleshooting)

발표 및 포트폴리오 활용을 위한 주요 기술적 해결 과정입니다.

### 1. 인스타그램 이미지 CORS 및 보안 우회
- **현상**: 인스타그램 CDN 이미지를 직접 사용 시 브라우저에서 차단됨.
- **해결**: `/api/proxy`를 통해 서버 측에서 이미지를 가져온 뒤 Base64로 변환하여 AI에게 전달하는 방식을 사용하여 보안 제약을 완벽히 극복했습니다.

### 2. AI 디자인 학습 로직 (JSONL)
- **현상**: 단순 프롬프트만으로는 원본의 디자인 구조를 따라하기 어려움.
- **해결**: 이미지를 레이아웃 단위로 쪼개어 분석하는 **JSONL 데이터 추출 파이프라인**을 구축했습니다. 이를 통해 디자인 에스테틱을 디지털 데이터화하여 AI가 정확히 복제하도록 구현했습니다.

### 3. Prisma 7 & 최신 API 스펙 대응
- **현상**: Prisma 7 버전의 파괴적 변경사항(Driver Adapter 필수) 및 OpenAI 모델의 최신 파라미터 규격 불일치로 시스템 마비.
- **해결**: `prisma.config.ts` 도입 및 `@prisma/adapter-pg`를 통한 명시적 어댑터 설정을 적용하여 안정성을 확보했습니다.

### 4. 이미지 분석 시간 50% 단축
- **현상**: 고해상도 이미지 처리로 인한 AI 분석 지연(Latency).
- **해결**: 클라이언트 측에서 이미지를 800px로 사전 압축하는 전처리 로직을 추가하여 분석 속도를 획기적으로 개선하고 이를 측정하는 타이머를 구현했습니다.

## 📱 프로젝트 구조 (Updated)

- `src/app/api/analyze/route.ts`: GPT-5.5 기반 디자인 데이터(JSONL) 정밀 추출.
- `src/app/api/transform/route.ts`: 학습된 데이터를 바탕으로 카드뉴스 배경 생성.
- `src/app/api/templates/route.ts`: Prisma DB를 활용한 사용자별 디자인 템플릿 관리.
- `src/components/CardGenerator.tsx`: 프리미엄 대시보드 UI 및 이미지 전처리 로직.
- `src/app/api/proxy/route.ts`: CORS 우회를 위한 이미지 프록시.

## 배포 가이드 (Deployment)

이 프로젝트는 **Vercel**에 최적화되어 있습니다.

1. **Vercel 회원가입/로그인** 후 [Vercel Dashboard](https://vercel.com/dashboard)로 이동합니다.
2. **Add New > Project**를 클릭하고 이 레포지토리(`carnews-insta`)를 Import 합니다.
3. **Environment Variables** 설정 섹션에서 다음 두 가지 키를 추가합니다:
   - `OPENAI_API_KEY`: 발급받은 OpenAI API 키
   - `RAPIDAPI_KEY`: 발급받은 RapidAPI 키
4. **Deploy** 버튼을 누르면 배포가 시작됩니다! 배포가 완료되면 제공되는 `.vercel.app` 주소로 전 세계 어디서든 접속 가능합니다.


