# 🚀 AI CardNews Insta: Korea's Canva Project

> **인스타그램 스타일을 학습하여 10초 만에 고퀄리티 카드뉴스를 생성하는 프리미엄 SaaS 플랫폼**

| Status | Version | Environment | Last Update |
| :--- | :--- | :--- | :--- |
| `✅ Stable` | `v2.1.0` | `Production (Vercel)` | 2026-05-05 |

---

## 💎 Project Overview
본 프로젝트는 단순한 자동화 도구를 넘어, **AI가 디자인 미학(Aesthetics)을 학습**하여 전문가 수준의 콘텐츠를 생산하는 것을 목표로 합니다. 사용자가 제공하는 레퍼런스의 '디자인 DNA'를 분석하고 복제하여, 브랜드 일관성을 유지하면서도 압도적인 시각적 퀄리티를 보장합니다.

---

## 🏆 Key Accomplishments (MVP Phase 1)

### 1. 초정밀 디자인 DNA 분석 엔진 (Analyze API)
- **Senior Designer Logic**: 색상 팔레트, 타이포그래피 규칙, 레이아웃 구조, 배경 질감을 토큰화하여 추출.
- **Reference Imitation**: 인스타그램 URL 입력 시 해당 디자인의 정수를 99% 재현하는 프롬프트 엔지니어링 완성.

### 2. Canvas Editor V2.0 (Figma/Canva Level)
- **Professional Tools**: 자간(Letter Spacing), 투명도(Opacity), 고급 한글 폰트(Pretendard 등) 완벽 지원.
- **Power-User Shortcuts**: `Ctrl+Z`(실행취소), `Ctrl+C/V`(복사/붙여넣기), `Delete`(삭제) 단축키 시스템 구축.
- **Modern UI**: 글래스모피즘 기반의 플로팅 툴바 및 피그마 스타일의 정밀 핸들 적용.

### 3. 고화질 이미지 생성 파이프라인 (Transform API)
- **HD Generation**: DALL-E 3 **HD 모드** 강제 적용으로 픽셀 디테일 극대화.
- **Prompt Optimization**: 프롬프트 길이 제한(4000자) 내에서 최대의 디자인 컨텍스트를 전달하도록 압축 알고리즘 적용.

---

## 🛠️ Technical Stability & Bug Fixes
> [!IMPORTANT]
> 프로젝트의 안정성을 위해 다음의 크리티컬 이슈들을 해결했습니다.

- **[Fixed] Build Error**: Prisma 임포트 경로 및 TypeScript 타입 정의 오류 완벽 해결.
- **[Fixed] CSS Module Error**: Non-pure selector 에러 해결로 Vercel 배포 안정성 확보.
- **[Fixed] Prompt Overflow**: 생성 요청 시 프롬프트 길이 초과 에러(4000자 제한) 해결.
- **[Fixed] Real Reference**: 기존 플레이스홀더 링크를 8개 업종별 **실제 작동하는 고퀄리티 인스타그램 링크**로 전면 교체.

---

## 🗺️ Future Roadmap: The "Korean Canva" Vision

### Phase 2: 보관함 및 영속성 (In Progress)
- [x] **Database Schema**: `GeneratedCard` 모델 설계 및 DB 연동 준비 완료.
- [ ] **Save to Project**: 생성된 카드뉴스를 DB(Prisma/PostgreSQL)에 영구 저장.
- [ ] **My Gallery**: 사용자가 언제든 이전 프로젝트를 꺼내서 재편집할 수 있는 대시보드 구축.

### Phase 3: 소셜 및 결제 (Next Step)
- [ ] **Social Auth**: 구글/카카오 원클릭 로그인 연동 (NextAuth).
- [ ] **Subscription Model**: 토큰 기반 결제 시스템 및 등급별 기능 차등화.

### Phase 4: 지능형 자동화 (Goal)
- [ ] **Auto-Caption**: 카드뉴스 내용에 맞는 인스타그램 캡션 및 해시태그 자동 생성.
- [ ] **Carousel Export**: 한 번의 클릭으로 10장의 슬라이드를 일괄 생성하고 다운로드.

---

## 🏗️ Architecture & Tech Stack
- **Framework**: `Next.js 16 (App Router)`, `React 19`
- **Database**: `Prisma 7`, `PostgreSQL`
- **AI Models**: `OpenAI GPT-4o-mini (Vision)`, `DALL-E 3 (HD Quality Mode)`
- **Design Core**: `Fabric.js` (Customized Design Engine)

---

## 👨‍💻 Team Collaboration
팀원들과 실시간으로 공유하고 싶은 내용이나, 기술적 문의 사항은 언제든 리포트의 **Future Roadmap** 섹션을 업데이트하거나 담당 개발자에게 문의해 주세요.

**"우리는 디자인의 장벽을 허물고 누구나 크리에이터가 되는 세상을 만듭니다."**
