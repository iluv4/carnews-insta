import Link from "next/link";
import styles from "./landing.module.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "픽스타그램 | 소상공인 AI 카드뉴스 자동 생성",
  description: "네이버 지도 사진만 있으면 끝. 10초 만에 인스타그램 카드뉴스가 완성됩니다. 식당·카페·뷰티샵 소상공인 전용 AI 콘텐츠 제작 서비스.",
  keywords: ["AI 카드뉴스", "소상공인 인스타그램", "카드뉴스 자동 생성", "네이버 지도", "식당 마케팅"],
  openGraph: {
    title: "픽스타그램 | 소상공인 AI 카드뉴스",
    description: "네이버 지도 사진 → 인스타 카드뉴스, 10초 완성",
    images: ["/logo.png"],
  },
};

const FEATURES = [
  {
    icon: "🗺️",
    title: "네이버 지도 자동 연동",
    desc: "가게 이름만 입력하면 네이버 지도 사진을 자동으로 가져옵니다. 사진을 직접 다운로드할 필요 없어요.",
  },
  {
    icon: "🧠",
    title: "인스타 스타일 학습",
    desc: "잘 되는 계정 URL 하나면 폰트·컬러·레이아웃을 AI가 분석해 그대로 따라합니다.",
  },
  {
    icon: "⚡",
    title: "10초 자동 생성",
    desc: "주제만 입력하면 커버부터 마지막 슬라이드까지 6장이 한꺼번에 완성됩니다.",
  },
  {
    icon: "✏️",
    title: "원클릭 편집",
    desc: "마음에 안 드는 텍스트만 클릭해서 고치세요. 전문 디자이너 없이도 됩니다.",
  },
  {
    icon: "📦",
    title: "업종별 전용 포털",
    desc: "식당, 카페, 뷰티샵, 사진관별로 최적화된 스타일이 미리 세팅되어 있습니다.",
  },
  {
    icon: "💾",
    title: "즉시 다운로드",
    desc: "생성된 카드뉴스를 고화질로 바로 다운받아 인스타에 올리세요. 별도 저장 불필요.",
  },
];

const STEPS = [
  {
    no: "01",
    title: "가게 이름 입력",
    desc: "네이버 지도에 등록된 가게 이름을 입력하면 사진을 자동으로 불러옵니다.",
    color: "#6366f1",
  },
  {
    no: "02",
    title: "주제 한 줄 입력",
    desc: "\"이번 주 신메뉴 홍보\", \"영업시간 안내\" 등 원하는 내용을 한 줄만 적으세요.",
    color: "#8b5cf6",
  },
  {
    no: "03",
    title: "카드뉴스 완성!",
    desc: "AI가 6장짜리 인스타 카드뉴스를 10초 안에 만들어드립니다.",
    color: "#a855f7",
  },
];

const REVIEWS = [
  {
    name: "부암동 카페 사장님",
    role: "카페 / 서울 부암동",
    text: "매주 인스타 올리는 게 제일 귀찮았는데, 이제 10분이면 한 주 콘텐츠가 다 해결돼요. 정말 신기합니다.",
    stars: 5,
  },
  {
    name: "홍대 네일샵 원장님",
    role: "뷰티샵 / 서울 마포",
    text: "디자이너한테 부탁하면 하루는 걸렸는데 이제 혼자서 그날그날 바로 올려요. 팔로워도 늘었어요.",
    stars: 5,
  },
  {
    name: "강남 증명사진관 대표",
    role: "사진관 / 서울 강남",
    text: "레퍼런스 인스타 URL 넣으니까 우리 감성이랑 딱 맞는 스타일로 나와서 깜짝 놀랐어요.",
    stars: 5,
  },
];

export default function LandingPage() {
  return (
    <div className={styles.root}>
      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logoArea}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className={styles.logoImg} />
            <span className={styles.logoText}>픽스타그램</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#how">사용 방법</a>
            <a href="#features">기능</a>
            <a href="#pricing">요금제</a>
            <a href="#reviews">후기</a>
          </div>
          <div className={styles.navCtas}>
            <Link href="/dashboard" className={styles.navLogin}>로그인</Link>
            <Link href="/dashboard" className={styles.navCta}>무료 시작 →</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            소상공인 1,200+ 매장이 사용 중
          </div>
          <h1 className={styles.heroTitle}>
            네이버 지도 사진으로<br />
            <span className={styles.heroGradient}>인스타 카드뉴스</span><br />
            10초 완성
          </h1>
          <p className={styles.heroSub}>
            사진 다운로드도 필요 없어요. 가게 이름만 입력하면<br className={styles.heroBr} />
            AI가 알아서 6장짜리 카드뉴스를 만들어드립니다.
          </p>
          <div className={styles.heroCtaRow}>
            <Link href="/dashboard" className={styles.heroCta}>
              무료로 만들어보기 →
            </Link>
            <a href="#how" className={styles.heroCtaGhost}>
              ▶ 사용법 보기
            </a>
          </div>
          <p className={styles.heroNote}>신용카드 불필요 · 3회 무료 · 1분 가입</p>
        </div>

        {/* Floating card mockups */}
        <div className={styles.heroVisual}>
          <div className={styles.cardStack}>
            <div className={styles.cardFloat + ' ' + styles.card1}>
              <div className={styles.cardInner} style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
                <div className={styles.cardLabel}>COVER</div>
                <div className={styles.cardTitle}>부암동 소소한풍경</div>
                <div className={styles.cardSub}>봄 메뉴 新출시 🌸</div>
              </div>
            </div>
            <div className={styles.cardFloat + ' ' + styles.card2}>
              <div className={styles.cardInner} style={{ background: 'linear-gradient(135deg,#0f3460,#533483)' }}>
                <div className={styles.cardLabel}>TIP</div>
                <div className={styles.cardTitle}>예약 꿀팁 3가지</div>
                <div className={styles.cardItems}>
                  <div>✓ 주말 2일 전 예약</div>
                  <div>✓ 웨이팅 앱 등록</div>
                  <div>✓ 단체는 전화로</div>
                </div>
              </div>
            </div>
            <div className={styles.cardFloat + ' ' + styles.card3}>
              <div className={styles.cardInner} style={{ background: 'linear-gradient(135deg,#e94560,#c62a2a)' }}>
                <div className={styles.cardLabel}>CTA</div>
                <div className={styles.cardTitle}>지금 예약하기</div>
                <div className={styles.cardCta}>📞 02-123-4567</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div className={styles.proofBar}>
        <div className={styles.proofInner}>
          <span>🍽️ 식당·카페</span>
          <span className={styles.proofDivider}>|</span>
          <span>💄 뷰티샵</span>
          <span className={styles.proofDivider}>|</span>
          <span>📸 사진관·스튜디오</span>
          <span className={styles.proofDivider}>|</span>
          <span>🏥 의원·클리닉</span>
          <span className={styles.proofDivider}>|</span>
          <span>🏋️ 피트니스·요가</span>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>사용 방법</div>
          <h2 className={styles.sectionTitle}>딱 3단계로 끝납니다</h2>
          <p className={styles.sectionDesc}>복잡한 디자인 툴 없이 누구나 바로 사용할 수 있어요.</p>
          <div className={styles.stepsGrid}>
            {STEPS.map((s) => (
              <div key={s.no} className={styles.stepCard}>
                <div className={styles.stepNo} style={{ color: s.color, borderColor: s.color + '30', background: s.color + '10' }}>
                  {s.no}
                </div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className={styles.featureSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>핵심 기능</div>
          <h2 className={styles.sectionTitle}>소상공인을 위해 만들었습니다</h2>
          <p className={styles.sectionDesc}>복잡한 것들은 AI가 다 합니다. 사장님은 내용만 입력하세요.</p>
          <div className={styles.featGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featCard}>
                <div className={styles.featIcon}>{f.icon}</div>
                <h3 className={styles.featTitle}>{f.title}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>요금제</div>
          <h2 className={styles.sectionTitle}>부담 없이 시작하세요</h2>
          <p className={styles.sectionDesc}>3회 무료 체험 후 마음에 드시면 구독하세요. 언제든 해지 가능합니다.</p>

          <div className={styles.pricingGrid}>
            {/* FREE */}
            <div className={styles.pricingCard}>
              <div className={styles.planTop}>
                <div className={styles.planName}>무료 체험</div>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>₩0</span>
                  <span className={styles.planPer}></span>
                </div>
                <p className={styles.planDesc}>먼저 써보고 결정하세요</p>
              </div>
              <ul className={styles.planFeatures}>
                <li><span className={styles.check}>✓</span> 월 3회 AI 카드뉴스 생성</li>
                <li><span className={styles.check}>✓</span> 기본 템플릿 라이브러리</li>
                <li><span className={styles.check}>✓</span> 고화질 다운로드</li>
                <li className={styles.planMuted}><span className={styles.cross}>✗</span> 네이버 지도 자동 연동</li>
                <li className={styles.planMuted}><span className={styles.cross}>✗</span> 업종별 전용 포털</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnSecondary}>무료로 시작하기</Link>
            </div>

            {/* PRO — highlighted */}
            <div className={styles.pricingCard + ' ' + styles.pricingHighlight}>
              <div className={styles.planBadge}>가장 인기</div>
              <div className={styles.planTop}>
                <div className={styles.planName}>스탠다드</div>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>₩19,000</span>
                  <span className={styles.planPer}>/ 월</span>
                </div>
                <p className={styles.planDesc}>혼자 운영하는 매장에 딱</p>
              </div>
              <ul className={styles.planFeatures}>
                <li><span className={styles.check}>✓</span> 무제한 AI 카드뉴스 생성</li>
                <li><span className={styles.check}>✓</span> 네이버 지도 사진 자동 연동</li>
                <li><span className={styles.check}>✓</span> 인스타 스타일 학습 (URL 분석)</li>
                <li><span className={styles.check}>✓</span> 전체 템플릿 라이브러리</li>
                <li><span className={styles.check}>✓</span> 고화질 다운로드</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnPrimary}>14일 무료 체험</Link>
              <p className={styles.planNote}>체험 후 자동 결제 없음</p>
            </div>

            {/* BUSINESS */}
            <div className={styles.pricingCard}>
              <div className={styles.planTop}>
                <div className={styles.planName}>포털 패키지</div>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>₩39,000</span>
                  <span className={styles.planPer}>/ 월</span>
                </div>
                <p className={styles.planDesc}>우리 가게 전용 포털이 생깁니다</p>
              </div>
              <ul className={styles.planFeatures}>
                <li><span className={styles.check}>✓</span> 스탠다드의 모든 기능</li>
                <li><span className={styles.check}>✓</span> 우리 가게 전용 AI 포털</li>
                <li><span className={styles.check}>✓</span> 브랜드 맞춤 템플릿 제작</li>
                <li><span className={styles.check}>✓</span> 월 콘텐츠 플래닝 1회 컨설팅</li>
                <li><span className={styles.check}>✓</span> 카카오채널 1:1 전담 지원</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnSecondary}>도입 문의하기</Link>
            </div>
          </div>

          <p className={styles.pricingNote}>
            💡 연간 구독 시 2개월 무료 · VAT 별도 · 언제든 해지 가능
          </p>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section id="reviews" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>고객 후기</div>
          <h2 className={styles.sectionTitle}>직접 써보신 사장님들의 말씀</h2>
          <div className={styles.reviewGrid}>
            {REVIEWS.map((r) => (
              <div key={r.name} className={styles.reviewCard}>
                <div className={styles.reviewStars}>
                  {'⭐'.repeat(r.stars)}
                </div>
                <p className={styles.reviewText}>&ldquo;{r.text}&rdquo;</p>
                <div className={styles.reviewAuthor}>
                  <div className={styles.reviewAvatar}>{r.name[0]}</div>
                  <div>
                    <div className={styles.reviewName}>{r.name}</div>
                    <div className={styles.reviewRole}>{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={styles.finalCta}>
        <div className={styles.finalGlow} />
        <div className={styles.finalContent}>
          <h2 className={styles.finalTitle}>오늘 첫 카드뉴스를 만들어보세요</h2>
          <p className={styles.finalSub}>
            3회 무료 · 신용카드 불필요 · 1분 가입
          </p>
          <Link href="/dashboard" className={styles.finalBtn}>
            무료로 시작하기 →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <div className={styles.footerLogo}>픽스타그램</div>
            <p className={styles.footerTagline}>소상공인을 위한 AI 카드뉴스 서비스</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">이용약관</a>
            <a href="#">개인정보처리방침</a>
            <a href="#">문의하기</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © 2026 픽스타그램. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
