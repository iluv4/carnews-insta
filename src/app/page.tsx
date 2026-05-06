import Link from "next/link";
import styles from "./landing.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "픽스타그램 | 소상공인 인스타 카드뉴스",
  description:
    "카드뉴스는 올리는데 문의가 없다면. 네이버 지도 사진으로 10초 만에 인스타 카드뉴스 완성.",
  keywords: ["카드뉴스", "소상공인 인스타그램", "카드뉴스 자동 생성", "네이버 지도"],
  openGraph: {
    title: "픽스타그램 | 소상공인 인스타 카드뉴스",
    description: "카드뉴스는 올리는데 문의가 없다면. 10초면 됩니다.",
    images: ["/logo.png"],
  },
};

/* ── Real thumbnail paths from saved-refs library ─────────────────── */
const COL1 = [
  "/saved-refs/saved_DMcfFaNz18t.jpg",
  "/saved-refs/saved_DXlvd9FiSGo.jpg",
  "/saved-refs/saved_DXgXgAWgaj6.jpg",
  "/saved-refs/saved_DWaxQGjjnV-.jpg",
  "/saved-refs/saved_C-QCe6gvswR.jpg",
  "/saved-refs/saved_DXhQlvdmYBb.jpg",
];
const COL2 = [
  "/saved-refs/saved_DXV3eIYEtFK.jpg",
  "/saved-refs/saved_DXbbCocgR-n.jpg",
  "/saved-refs/saved_DXvPnrjgX5D.jpg",
  "/saved-refs/saved_DXs7TFegHrX.jpg",
  "/saved-refs/saved_DXtUkPZiQBU.jpg",
  "/saved-refs/saved_DXgBRlBiSc5.jpg",
];
const GALLERY = [
  { src: "/saved-refs/saved_DMcfFaNz18t.jpg",  label: "카페/음식점" },
  { src: "/saved-refs/saved_DXlvd9FiSGo.jpg",  label: "카페/공간" },
  { src: "/saved-refs/saved_DXgXgAWgaj6.jpg",  label: "식품/제과" },
  { src: "/saved-refs/saved_DWaxQGjjnV-.jpg",  label: "패션/매거진" },
  { src: "/saved-refs/saved_C-QCe6gvswR.jpg",  label: "정보형/에디토리얼" },
  { src: "/saved-refs/saved_DXhQlvdmYBb.jpg",  label: "SNS 마케팅" },
  { src: "/saved-refs/saved_DXV3eIYEtFK.jpg",  label: "미니멀/브랜딩" },
  { src: "/saved-refs/saved_DXbbCocgR-n.jpg",  label: "Y2K/복고" },
  { src: "/saved-refs/saved_DXvPnrjgX5D.jpg",  label: "3D/트렌디" },
  { src: "/saved-refs/saved_DXs7TFegHrX.jpg",  label: "미니멀/블랙" },
  { src: "/saved-refs/saved_DU8Ly-xk4fG.jpg",  label: "사진관/스튜디오" },
  { src: "/saved-refs/saved_DTha7kSAbDz.jpg",  label: "라이프스타일" },
  { src: "/saved-refs/saved_DSRnPLjEiQ2.jpg",  label: "보험/금융" },
  { src: "/saved-refs/saved_DOiPIpEgay7.jpg",  label: "도시/여행" },
  { src: "/saved-refs/saved_C-Ul3yQpgWw.jpg",  label: "피드 디자인" },
  { src: "/saved-refs/saved_DXtUkPZiQBU.jpg",  label: "크리에이터" },
];

const STEPS = [
  {
    no: "01",
    title: "가게 이름 입력",
    desc: "네이버 지도에 등록된 이름을 입력하면 사진을 알아서 가져옵니다. 사진 다운로드 필요 없어요.",
  },
  {
    no: "02",
    title: "주제 한 줄",
    desc: '"이번 주 신메뉴", "영업시간 변경 공지" 이런 거요. 한 줄이면 됩니다.',
  },
  {
    no: "03",
    title: "10초 뒤 완성",
    desc: "6장짜리 카드뉴스가 나옵니다. 마음에 안 드는 텍스트만 고치고 올리세요.",
  },
];

const WHY = [
  {
    q: '"편집이 너무 오래 걸려요"',
    a: "10초면 됩니다. 사진은 네이버 지도에서 알아서 가져오고, 글씨도 AI가 씁니다.",
  },
  {
    q: '"디자인 감각이 없어서 촌스러워요"',
    a: "잘 되는 인스타 계정 URL 하나만 주면 그 스타일로 만들어드립니다.",
  },
  {
    q: '"디자이너한테 맡기면 하루가 넘어요"',
    a: "지금 당장 만들어보세요. 신용카드 없어도 3번은 무료입니다.",
  },
  {
    q: '"올리긴 하는데 반응이 없어요"',
    a: "업종·주제에 맞는 포맷으로 만들어드립니다. 식당은 식당 구조로, 뷰티샵은 뷰티샵 구조로.",
  },
];

const REVIEWS = [
  {
    name: "부암동 카페 사장님",
    role: "카페 / 서울",
    text: "매주 인스타 올리는 게 제일 귀찮았는데, 이제 10분이면 한 주 분량이 다 해결돼요.",
  },
  {
    name: "홍대 네일샵 원장님",
    role: "뷰티샵 / 서울 마포",
    text: "디자이너한테 부탁하면 하루는 걸렸는데 이제 혼자서 그날그날 바로 올려요. 팔로워도 늘었어요.",
  },
  {
    name: "강남 증명사진관 대표",
    role: "사진관 / 서울",
    text: "레퍼런스 인스타 URL 넣으니까 우리 감성이랑 딱 맞는 스타일로 나와서 깜짝 놀랐어요.",
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
            <img src="/logo.png" alt="픽스타그램" className={styles.logoImg} />
            <span className={styles.logoText}>픽스타그램</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#how">사용법</a>
            <a href="#gallery">레퍼런스</a>
            <a href="#pricing">요금제</a>
          </div>
          <div className={styles.navCtas}>
            <Link href="/dashboard" className={styles.navLogin}>로그인</Link>
            <Link href="/dashboard" className={styles.navCta}>무료로 해보기</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroBadge}>소상공인 인스타 카드뉴스 도구</p>

          <h1 className={styles.heroTitle}>
            카드뉴스는 올리는데,<br />
            왜 문의는<br />
            <em>안 올까요?</em>
          </h1>

          <p className={styles.heroSub}>
            네이버 지도 사진 하나면 됩니다.<br />
            가게 이름만 입력하면 10초 후에<br />
            올릴 수 있는 카드뉴스가 나옵니다.
          </p>

          <div className={styles.heroCtaRow}>
            <Link href="/dashboard" className={styles.heroCta}>
              한 번 만들어보기
            </Link>
            <a href="#how" className={styles.heroCtaGhost}>
              어떻게 되는지 보기 →
            </a>
          </div>

          <p className={styles.heroNote}>신용카드 없어도 됩니다 · 3번은 무료</p>
        </div>

        {/* ── Scrolling thumbnail columns ── */}
        <div className={styles.heroRight} aria-hidden="true">
          <div className={styles.marqMask}>
            <div className={styles.marqCol}>
              <div className={styles.marqTrack}>
                {[...COL1, ...COL1].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} className={styles.marqImg} alt="" />
                ))}
              </div>
            </div>
            <div className={styles.marqCol}>
              <div className={`${styles.marqTrack} ${styles.marqTrackRev}`}>
                {[...COL2, ...COL2].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} className={styles.marqImg} alt="" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INDUSTRY BAR ── */}
      <div className={styles.industryBar}>
        <div className={styles.industryInner}>
          {["🍽️ 식당·카페", "💄 뷰티·네일", "📸 사진관", "🏥 의원·클리닉", "🏋️ 피트니스", "🛍️ 소매·쇼핑"].map((t) => (
            <span key={t} className={styles.industryTag}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>어떻게 하면 되나요?</p>
          <h2 className={styles.sectionTitle}>딱 3단계입니다</h2>
          <div className={styles.stepsGrid}>
            {STEPS.map((s, i) => (
              <div key={s.no} className={styles.stepCard}>
                <span className={styles.stepNo}>{s.no}</span>
                {i < STEPS.length - 1 && <span className={styles.stepArrow}>→</span>}
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section id="gallery" className={styles.gallerySection}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>레퍼런스 라이브러리</p>
          <h2 className={styles.sectionTitle}>
            스타일은 직접 골라서 쓰세요
          </h2>
          <p className={styles.sectionDesc}>
            저장된 레퍼런스 스타일을 골라 내 가게 사진에 입혀드립니다.
            카페부터 뷰티샵, 증명사진관까지.
          </p>
          <div className={styles.galleryGrid}>
            {GALLERY.map((g) => (
              <Link key={g.src} href="/dashboard" className={styles.galleryItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.label} className={styles.galleryImg} />
                <span className={styles.galleryLabel}>{g.label}</span>
              </Link>
            ))}
          </div>
          <div className={styles.galleryCta}>
            <Link href="/dashboard" className={styles.galleryBtn}>
              모든 스타일 보러가기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className={styles.whySection}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>이런 분들이 씁니다</p>
          <h2 className={styles.sectionTitle}>
            디자이너도 없고,<br />시간도 없는 사장님을 위해 만들었어요
          </h2>
          <div className={styles.whyGrid}>
            {WHY.map((w) => (
              <div key={w.q} className={styles.whyCard}>
                <p className={styles.whyQ}>{w.q}</p>
                <p className={styles.whyA}>{w.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrowLight}>얼마인가요?</p>
          <h2 className={styles.sectionTitleLight}>3번은 무료입니다</h2>
          <p className={styles.sectionDescLight}>
            그 다음부터만 결제하면 되고, 언제든 해지할 수 있어요.
          </p>

          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planName}>무료</div>
              <div className={styles.planPrice}><b>₩0</b></div>
              <p className={styles.planDesc}>먼저 써보고 결정하세요</p>
              <ul className={styles.planFeatures}>
                <li>✓ 월 3회 카드뉴스 생성</li>
                <li>✓ 기본 템플릿</li>
                <li>✓ 고화질 다운로드</li>
                <li className={styles.planOff}>✗ 네이버 지도 자동 연동</li>
                <li className={styles.planOff}>✗ 업종 전용 포털</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnGhost}>무료 시작</Link>
            </div>

            <div className={`${styles.pricingCard} ${styles.pricingPick}`}>
              <div className={styles.planBadge}>가장 많이 선택</div>
              <div className={styles.planName}>스탠다드</div>
              <div className={styles.planPrice}><b>₩19,000</b><span>/ 월</span></div>
              <p className={styles.planDesc}>혼자 운영하는 매장에 딱</p>
              <ul className={styles.planFeatures}>
                <li>✓ 무제한 카드뉴스 생성</li>
                <li>✓ 네이버 지도 자동 연동</li>
                <li>✓ 레퍼런스 스타일 학습</li>
                <li>✓ 전체 템플릿 라이브러리</li>
                <li>✓ 고화질 다운로드</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnPrimary}>14일 무료 체험</Link>
              <p className={styles.planNote}>체험 후 자동결제 없음</p>
            </div>

            <div className={styles.pricingCard}>
              <div className={styles.planName}>포털 패키지</div>
              <div className={styles.planPrice}><b>₩39,000</b><span>/ 월</span></div>
              <p className={styles.planDesc}>우리 가게 전용 포털이 생깁니다</p>
              <ul className={styles.planFeatures}>
                <li>✓ 스탠다드 전체 포함</li>
                <li>✓ 가게 전용 AI 포털</li>
                <li>✓ 브랜드 맞춤 템플릿</li>
                <li>✓ 월 콘텐츠 플래닝 1회</li>
                <li>✓ 카카오 1:1 전담 지원</li>
              </ul>
              <Link href="/dashboard" className={styles.planBtnGhost}>문의하기</Link>
            </div>
          </div>

          <p className={styles.pricingNote}>
            연간 구독 시 2개월 무료 · VAT 별도 · 언제든 해지 가능
          </p>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section id="reviews" className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>실제로 써보신 분들이 한 말</p>
          <h2 className={styles.sectionTitle}>직접 올려보신 사장님들</h2>
          <div className={styles.reviewGrid}>
            {REVIEWS.map((r) => (
              <div key={r.name} className={styles.reviewCard}>
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
        <h2 className={styles.finalTitle}>지금 바로 만들어보세요</h2>
        <p className={styles.finalSub}>
          신용카드 없어도 됩니다. 3번은 무료예요.
        </p>
        <Link href="/dashboard" className={styles.finalBtn}>
          무료로 시작하기
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerLogo}>픽스타그램</div>
            <p className={styles.footerTagline}>소상공인을 위한 AI 카드뉴스 서비스</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">이용약관</a>
            <a href="#">개인정보처리방침</a>
            <a href="#">문의하기</a>
          </div>
        </div>
        <div className={styles.footerBottom}>© 2026 픽스타그램.</div>
      </footer>

    </div>
  );
}
