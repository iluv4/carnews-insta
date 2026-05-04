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

## 프로젝트 구조

- `src/app/page.tsx`: UI가 포함된 메인 애플리케이션 페이지.
- `src/components/CardGenerator.tsx`: 입력 폼과 생성된 카드 뉴스 미리보기를 담당하는 핵심 컴포넌트.
- `src/app/api/instagram/route.ts`: 인스타그램 URL 스크래핑을 처리하는 API 라우트.
- `src/app/api/transform/route.ts`: OpenAI GPT-Image-2 프롬프트 및 이미지 생성 요청을 처리하는 API 라우트.


