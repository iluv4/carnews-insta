# 인스타그램 카드 뉴스 자동 생성기 (Instagram Card News Generator)

인스타그램 카드 뉴스 콘텐츠를 자동으로 아름답게 생성해 주는 Next.js 웹 애플리케이션입니다. 인스타그램 URL에서 이미지 데이터를 추출하고, OpenAI의 DALL-E 2를 사용하여 입력하신 테마와 스타일에 맞춘 새로운 카드 뉴스 배경 이미지를 생성합니다.

## 주요 기능

- **인스타그램 링크 스크래핑:** 인스타그램 게시물 URL에서 이미지 데이터를 직접 추출합니다. (참고: 인스타그램 측의 차단 시 기본 대체 이미지가 사용됩니다).
- **AI 기반 이미지 생성:** OpenAI의 DALL-E 2와 연동하여, 특정 테마와 레퍼런스 스타일에 맞는 카드 뉴스용 고품질 이미지를 생성합니다.
- **모던 UI:** Next.js와 React를 기반으로 구축되었으며, 생성된 카드 뉴스를 미리 보고 커스터마이징할 수 있는 깔끔하고 인터랙티브한 인터페이스를 제공합니다.

## 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/) (App Router)
- **라이브러리:** [React](https://react.dev/)
- **스타일링:** CSS Modules
- **웹 스크래핑:** [Cheerio](https://cheerio.js.org/) & [Axios](https://axios-http.com/)
- **AI 연동:** [OpenAI API](https://platform.openai.com/docs/api-reference) (DALL-E 2)

## 시작하기 전에 (Prerequisites)

로컬에서 프로젝트를 실행하려면 다음 항목들이 설치되어 있어야 합니다:
- Node.js (v18 이상 권장)
- npm, yarn, pnpm 또는 bun

AI 이미지 생성 기능을 사용하기 위해서는 **OpenAI API Key**가 필요합니다.

## 환경 변수 (Environment Variables)

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 발급받은 OpenAI API 키를 추가해 주세요:

```env
OPENAI_API_KEY=여기에_openai_api_키를_입력하세요
```
*(API 키가 제공되지 않을 경우, 애플리케이션은 시뮬레이션 모드로 작동하며 기본 자리 표시자(placeholder) 이미지를 반환합니다).*

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
- `src/app/api/transform/route.ts`: OpenAI DALL-E 2 프롬프트 및 이미지 생성 요청을 처리하는 API 라우트.

## 향후 과제 (Future Enhancements)
- 생성된 배경 이미지 위에 직접 텍스트를 오버레이하는 기능 추가.
- 이미지 변환 전, 원본 인스타그램 이미지를 분석하기 위한 GPT-4V(비전) 연동 기능.
- 최종 완성된 카드 뉴스 이미지를 다운로드하는 기능.
