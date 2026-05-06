/**
 * ─────────────────────────────────────────────────────────────
 *  [이름] AI PAGE — 카드뉴스 컨설팅 판매형 원페이지
 *
 *  ✏️ 교체 가능한 모든 항목은 SITE_CONFIG 객체에 모아두었습니다.
 *     실제 운영 시 이 파일의 SITE_CONFIG만 수정하면 전체 반영됩니다.
 * ─────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next';
import styles from './consulting.module.css';

/* ═══════════════════════════════════════════════════════════════
   ✏️ SITE CONFIG — 여기만 수정하세요
═══════════════════════════════════════════════════════════════ */
const SITE_CONFIG = {
  /** 본인 이름 (예: 김민지) */
  name: '홍길동',

  /** AI PAGE 한 줄 설명 */
  aiPageDesc: '소상공인의 매출을 올리는 카드뉴스 시스템',

  /** 직함/소개 한 줄 */
  tagline: '카드뉴스 컨설턴트 · AI 콘텐츠 전략가',

  /** 주 CTA 링크 (카카오 오픈채팅) */
  kakaoUrl: 'https://open.kakao.com/o/XXXXXXXX',

  /** 보조 CTA 링크 (인스타그램 DM) */
  instaUrl: 'https://www.instagram.com/your_account/',

  /** 인스타그램 계정명 (@포함) */
  instaHandle: '@your_account',

  /** 운영 실적 숫자 (신뢰 지표) */
  stats: [
    { value: '300+', label: '제작한 카드뉴스' },
    { value: '47개', label: '컨설팅 완료 업체' },
    { value: '2.8배', label: '평균 반응률 향상' },
    { value: '94%', label: '재의뢰·추천율' },
  ],

  /** 포트폴리오 사례 — "문제 → 방식 → 결과" 구조 */
  portfolio: [
    {
      emoji: '🍜',
      category: '부암동 식당',
      before: '게시물 조회수 평균 120회, DM 문의 월 2건',
      how: '메뉴 스토리 카드뉴스 + 네이버 지도 사진 활용',
      after: '조회수 1,400회, DM 문의 월 18건으로 증가',
      badge: '조회수 11배',
    },
    {
      emoji: '💅',
      category: '홍대 네일샵',
      before: '인스타 팔로워 230명, 예약은 지인 위주',
      how: '시술 전후 비교 + 가격 안내 카드뉴스 시리즈',
      after: '팔로워 1,100명, 신규 예약 월 35건 증가',
      badge: '신규예약 35건↑',
    },
    {
      emoji: '📸',
      category: '강남 증명사진관',
      before: '검색 유입은 있지만 인스타 반응 전무',
      how: '\'인생증사 꿀팁\' 정보형 카드뉴스 6주 연속 발행',
      after: '저장률 평균 8.4%, 문의 전환 월 22건',
      badge: '저장률 8.4%',
    },
    {
      emoji: '☕',
      category: '연남동 카페',
      before: '분위기 좋은데 SNS엔 아무도 안 오고 있었음',
      how: '시즌 음료 신메뉴 + 공간 스토리 카드뉴스',
      after: '\'연남동 카페 추천\' 태그 1위, 주말 웨이팅 발생',
      badge: '태그 검색 1위',
    },
  ],

  /** 서비스 패키지 */
  packages: [
    {
      name: '스타터 컨설팅',
      price: '97,000',
      unit: '원 (1회)',
      desc: '처음 시작하는 분들을 위한 맞춤 방향 설정',
      features: [
        '계정 진단 + 콘텐츠 방향 설계',
        '업종 맞춤 레퍼런스 5종 제공',
        '첫 카드뉴스 제작 피드백',
        '카카오 채팅 2주 Q&A',
      ],
      cta: '상담 신청',
      highlight: false,
    },
    {
      name: 'AI PAGE 집중 코스',
      price: '197,000',
      unit: '원 (4주)',
      desc: '직접 만드는 법을 배우고 자립하는 과정',
      features: [
        '스타터의 모든 내용 포함',
        'AI 도구 활용 실습 4회 (줌)',
        '업종 전용 템플릿 시스템 구축',
        '4주 콘텐츠 플래닝 + 피드백',
        '수료 후 1개월 채팅 지원',
      ],
      cta: '지금 신청하기',
      highlight: true,
      badge: '가장 많이 선택',
    },
    {
      name: 'VIP 대행 패키지',
      price: '상담 후',
      unit: '제안',
      desc: '직접 할 시간이 없는 분들을 위한 완전 대행',
      features: [
        '월 카드뉴스 8~12장 제작 대행',
        '인스타 업로드 + 해시태그 세팅',
        '반응 분석 리포트 월 1회',
        '긴급 수정 24시간 대응',
      ],
      cta: '대행 문의하기',
      highlight: false,
    },
  ],

  /** 작업 진행 단계 */
  process: [
    { no: '01', title: '무료 상담', desc: '카카오 오픈채팅으로 업종·목표·현재 상황을 10분 안에 파악합니다.' },
    { no: '02', title: '맞춤 진단', desc: '계정 분석 후 지금 당장 바꿔야 할 포인트 3가지를 정리해 드립니다.' },
    { no: '03', title: '전략 설계', desc: '업종·타깃·목표에 맞는 카드뉴스 시스템과 콘텐츠 플랜을 함께 만듭니다.' },
    { no: '04', title: '실행·피드백', desc: '직접 만들거나(코스), 제가 대신 만들어(대행) 인스타에 올라가는 걸 확인합니다.' },
  ],

  /** 고객 후기 */
  reviews: [
    {
      name: 'ㅇㅇ 식당 사장님',
      location: '서울 마포',
      text: '인스타를 3년 했는데 반응이 없었어요. 컨설팅 받고 딱 2주 만에 DM이 오기 시작했습니다. 카드뉴스가 이렇게 중요한 줄 몰랐어요.',
      tag: '매출 연결',
    },
    {
      name: 'ㅇㅇ 원장님',
      location: '경기 분당',
      text: 'AI 툴 쓰는 게 어렵지 않을까 걱정했는데 실습 위주로 알려주셔서 저도 혼자 만들 수 있게 됐어요. 지금은 매주 카드뉴스 올리고 있습니다.',
      tag: '자립 성공',
    },
    {
      name: 'ㅇㅇ 대표님',
      location: '부산 해운대',
      text: '대행 맡기고 2달 만에 팔로워 600명 늘었고, 예약 페이지 링크 클릭이 진짜 눈에 띄게 늘었어요. 투자 대비 효과가 확실합니다.',
      tag: '대행 대만족',
    },
  ],

  /** FAQ */
  faq: [
    {
      q: '카드뉴스 만든 경험이 전혀 없어도 괜찮나요?',
      a: '네, 오히려 처음부터 올바른 방법을 배우는 게 더 효율적입니다. 스타터 컨설팅은 방향 설정이 핵심이라 경험 없이도 충분히 시작할 수 있습니다.',
    },
    {
      q: 'AI 도구를 써도 콘텐츠가 우리 가게답게 나오나요?',
      a: '네. AI PAGE 시스템은 AI가 틀을 만들고, 사장님만의 사진·스토리·말투를 입히는 방식입니다. 결과물이 "AI 같아 보이는" 문제를 처음부터 방지합니다.',
    },
    {
      q: '카카오 오픈채팅 상담은 무료인가요?',
      a: '첫 상담 10~15분은 무료입니다. 계정 분석과 방향 조언까지 드리며, 이후 정식 컨설팅은 패키지 선택 후 진행됩니다.',
    },
    {
      q: '대행 패키지는 계약 기간이 있나요?',
      a: '최소 2개월 단위로 진행합니다. 계속 이어가고 싶으시면 한 달 전에 알려주시면 되고, 종료도 자유롭습니다.',
    },
    {
      q: '음식점 말고 다른 업종도 되나요?',
      a: '카드뉴스가 효과적인 업종이라면 모두 가능합니다. 뷰티, 사진관, 학원, 의원, 부동산, 피트니스 등 다양한 업종 경험이 있습니다.',
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   METADATA
═══════════════════════════════════════════════════════════════ */
export const metadata: Metadata = {
  title: `${SITE_CONFIG.name} AI PAGE | 소상공인 카드뉴스 컨설팅`,
  description: `${SITE_CONFIG.aiPageDesc}. 예쁜 카드뉴스가 아닌 팔리는 카드뉴스를 만드는 ${SITE_CONFIG.name}의 컨설팅·강의·대행 서비스.`,
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ConsultingPage() {
  const cfg = SITE_CONFIG;

  return (
    <div className={styles.root}>

      {/* ── STICKY NAV ── */}
      <nav className={styles.nav}>
        <span className={styles.navBrand}>{cfg.name} <em>AI PAGE</em></span>
        <div className={styles.navActions}>
          <a href={cfg.instaUrl} target="_blank" rel="noopener" className={styles.navInsta}>
            {cfg.instaHandle}
          </a>
          <a href={cfg.kakaoUrl} target="_blank" rel="noopener" className={styles.navKakao}>
            💬 무료 상담
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>✦ {cfg.aiPageDesc}</div>
          <h1 className={styles.heroTitle}>
            예쁜 카드뉴스 말고<br />
            <span className={styles.heroAccent}>팔리는</span> 카드뉴스
          </h1>
          <p className={styles.heroSub}>
            조회수·저장·DM 문의까지 이어지는 카드뉴스엔 공식이 있습니다.<br />
            {cfg.name}의 AI PAGE 시스템으로 소상공인 인스타를 바꿔드립니다.
          </p>
          <div className={styles.heroCtaRow}>
            <a href={cfg.kakaoUrl} target="_blank" rel="noopener" className={styles.ctaKakao}>
              💬 카카오 오픈채팅 무료 상담
            </a>
            <a href={cfg.instaUrl} target="_blank" rel="noopener" className={styles.ctaInsta}>
              📩 인스타그램 DM 문의
            </a>
          </div>
          <p className={styles.heroNote}>첫 상담 10분 무료 · 부담 없이 물어보세요</p>

          {/* Stats */}
          <div className={styles.statsRow}>
            {cfg.stats.map((s) => (
              <div key={s.label} className={styles.statItem}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM SYMPATHY ── */}
      <section className={styles.problem}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>이런 고민 있으신가요?</div>
          <h2 className={styles.sectionTitle}>
            열심히 올리는데<br className={styles.mBr} /> 왜 반응이 없을까요
          </h2>
          <div className={styles.problemGrid}>
            {[
              { icon: '😩', text: '사진 찍어서 올리는데 좋아요가 가족·지인뿐이에요' },
              { icon: '😰', text: '디자인 감각이 없어서 카드뉴스 만들기가 두려워요' },
              { icon: '😤', text: '인스타 꾸준히 했는데 문의·예약으로 안 이어져요' },
              { icon: '😓', text: '디자이너 맡기면 비싸고, AI 쓰면 뭔가 어색해요' },
              { icon: '😮‍💨', text: '뭘 올려야 할지 몰라서 업로드 자체가 밀려요' },
              { icon: '😶', text: '잘 되는 계정이랑 뭐가 다른지 도저히 모르겠어요' },
            ].map((p) => (
              <div key={p.text} className={styles.problemCard}>
                <span className={styles.problemEmoji}>{p.icon}</span>
                <p className={styles.problemText}>{p.text}</p>
              </div>
            ))}
          </div>
          <div className={styles.problemAnswer}>
            <strong>이 고민들, 카드뉴스 공식 하나로 다 해결됩니다.</strong>
          </div>
        </div>
      </section>

      {/* ── WHY CARD NEWS ── */}
      <section className={styles.why}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>왜 카드뉴스인가</div>
          <h2 className={styles.sectionTitle}>
            카드뉴스가 매출로 연결되는<br className={styles.mBr} /> 3가지 이유
          </h2>
          <div className={styles.whyGrid}>
            <div className={styles.whyCard}>
              <div className={styles.whyNo}>01</div>
              <h3 className={styles.whyTitle}>저장 = 의도된 재방문</h3>
              <p className={styles.whyDesc}>
                카드뉴스는 사진보다 저장률이 3~8배 높습니다. 저장한 사람은 "나중에 여기 가야지"라고 마음먹은 잠재 고객입니다.
              </p>
            </div>
            <div className={styles.whyCard}>
              <div className={styles.whyNo}>02</div>
              <h3 className={styles.whyTitle}>정보 = 신뢰 → 문의</h3>
              <p className={styles.whyDesc}>
                가격·메뉴·예약법을 카드뉴스로 미리 보여주면 "어떻게 해요?"라는 기초 질문 대신 "예약하고 싶어요"로 바로 넘어옵니다.
              </p>
            </div>
            <div className={styles.whyCard}>
              <div className={styles.whyNo}>03</div>
              <h3 className={styles.whyTitle}>알고리즘 = 검색 노출</h3>
              <p className={styles.whyDesc}>
                정보성 카드뉴스는 해시태그 검색에 더 오래 노출됩니다. 자는 동안에도 새 고객이 계정을 발견하는 구조를 만들 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO ── */}
      <section className={styles.portfolio}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>포트폴리오 · 성과 사례</div>
          <h2 className={styles.sectionTitle}>
            실제로 바뀐 것들을<br className={styles.mBr} /> 직접 보여드립니다
          </h2>
          <div className={styles.portfolioGrid}>
            {cfg.portfolio.map((p) => (
              <div key={p.category} className={styles.portfolioCard}>
                <div className={styles.portHeader}>
                  <span className={styles.portEmoji}>{p.emoji}</span>
                  <span className={styles.portCategory}>{p.category}</span>
                  <span className={styles.portBadge}>{p.badge}</span>
                </div>
                <div className={styles.portRow}>
                  <span className={styles.portLabel}>이전</span>
                  <p className={styles.portText}>{p.before}</p>
                </div>
                <div className={styles.portRow}>
                  <span className={styles.portLabelHow}>방식</span>
                  <p className={styles.portText}>{p.how}</p>
                </div>
                <div className={styles.portRow + ' ' + styles.portAfterRow}>
                  <span className={styles.portLabelAfter}>결과</span>
                  <p className={styles.portTextAfter}>{p.after}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.portfolioCta}>
            <p>내 업종 사례가 궁금하다면?</p>
            <a href={cfg.kakaoUrl} target="_blank" rel="noopener" className={styles.ctaKakaoSmall}>
              💬 오픈채팅으로 사례 더 보기
            </a>
          </div>
        </div>
      </section>

      {/* ── PACKAGES ── */}
      <section className={styles.packages}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>서비스 패키지</div>
          <h2 className={styles.sectionTitle}>
            지금 상황에 맞는<br className={styles.mBr} /> 시작점을 고르세요
          </h2>
          <div className={styles.packageGrid}>
            {cfg.packages.map((pkg) => (
              <div key={pkg.name} className={styles.pkgCard + (pkg.highlight ? ' ' + styles.pkgHighlight : '')}>
                {pkg.badge && <div className={styles.pkgBadge}>{pkg.badge}</div>}
                <h3 className={styles.pkgName}>{pkg.name}</h3>
                <div className={styles.pkgPriceRow}>
                  <span className={styles.pkgPrice}>{pkg.price}</span>
                  <span className={styles.pkgUnit}>{pkg.unit}</span>
                </div>
                <p className={styles.pkgDesc}>{pkg.desc}</p>
                <ul className={styles.pkgFeatures}>
                  {pkg.features.map((f) => (
                    <li key={f}><span className={styles.pkgCheck}>✓</span> {f}</li>
                  ))}
                </ul>
                <a
                  href={cfg.kakaoUrl}
                  target="_blank"
                  rel="noopener"
                  className={pkg.highlight ? styles.ctaKakao : styles.ctaKakaoOutline}
                >
                  💬 {pkg.cta}
                </a>
              </div>
            ))}
          </div>
          <p className={styles.packageNote}>
            ※ 모든 패키지는 VAT 별도 / 결제 후 24시간 내 시작 / 환불 정책 상담 시 안내
          </p>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section className={styles.process}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>작업 · 진행 방식</div>
          <h2 className={styles.sectionTitle}>
            첫 연락부터<br className={styles.mBr} /> 결과까지
          </h2>
          <div className={styles.processSteps}>
            {cfg.process.map((s, i) => (
              <div key={s.no} className={styles.processStep}>
                <div className={styles.processNo}>{s.no}</div>
                {i < cfg.process.length - 1 && <div className={styles.processLine} />}
                <h3 className={styles.processTitle}>{s.title}</h3>
                <p className={styles.processDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className={styles.reviews}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>고객 후기</div>
          <h2 className={styles.sectionTitle}>직접 경험한 분들의 말씀</h2>
          <div className={styles.reviewGrid}>
            {cfg.reviews.map((r) => (
              <div key={r.name} className={styles.reviewCard}>
                <div className={styles.reviewTag}>{r.tag}</div>
                <p className={styles.reviewText}>&ldquo;{r.text}&rdquo;</p>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAvatar}>{r.name[0]}</div>
                  <div>
                    <div className={styles.reviewName}>{r.name}</div>
                    <div className={styles.reviewLocation}>{r.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={styles.faq}>
        <div className={styles.inner}>
          <div className={styles.sectionTag}>자주 묻는 질문</div>
          <h2 className={styles.sectionTitle}>궁금한 게 있으신가요</h2>
          <div className={styles.faqList}>
            {cfg.faq.map((item) => (
              <div key={item.q} className={styles.faqItem}>
                <div className={styles.faqQ}>
                  <span className={styles.faqQMark}>Q</span>
                  {item.q}
                </div>
                <div className={styles.faqA}>
                  <span className={styles.faqAMark}>A</span>
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={styles.finalCta}>
        <div className={styles.finalInner}>
          <h2 className={styles.finalTitle}>
            첫 상담은 무료입니다<br />
            지금 연락주세요
          </h2>
          <p className={styles.finalSub}>
            업종·계정 상황에 따라 맞춤 방향을 먼저 알려드립니다.<br />
            부담 없이 물어봐도 됩니다.
          </p>
          <div className={styles.finalCtaRow}>
            <a href={cfg.kakaoUrl} target="_blank" rel="noopener" className={styles.ctaKakaoLg}>
              💬 카카오 오픈채팅으로 상담하기
            </a>
            <a href={cfg.instaUrl} target="_blank" rel="noopener" className={styles.ctaInstaLg}>
              📩 인스타그램 DM 보내기
            </a>
          </div>
          <p className={styles.finalNote}>{cfg.name} · {cfg.tagline}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <p>{cfg.name} AI PAGE &copy; 2026</p>
        <p className={styles.footerLinks}>
          <a href={cfg.kakaoUrl} target="_blank" rel="noopener">카카오 오픈채팅</a>
          <span>·</span>
          <a href={cfg.instaUrl} target="_blank" rel="noopener">{cfg.instaHandle}</a>
        </p>
      </footer>

    </div>
  );
}
