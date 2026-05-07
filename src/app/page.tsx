import Link from "next/link";
import styles from "./landing.module.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CarNews Insta | AI 카드뉴스 자동 생성 서비스",
  description: "인스타그램 스타일을 학습한 AI로 10초 만에 전문가급 카드뉴스를 제작하세요. 디자인 고충 끝, 생성은 AI에게 맡기세요.",
  keywords: ["AI 카드뉴스", "인스타그램 자동화", "카드뉴스 제작", "콘텐츠 생성", "CarNews Insta"],
  openGraph: {
    title: "CarNews Insta | AI 카드뉴스 자동 생성",
    description: "전문가처럼 디자인하고 10초 만에 완성하세요.",
    images: ["/logo.png"],
  },
};

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.logoArea}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <span>CarNews Insta</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">기능</a>
          <a href="#pricing">요금제</a>
          <a href="#showcase">쇼케이스</a>
        </div>
        <Link href="/dashboard" className="btn-primary">
          시작하기
        </Link>
      </nav>

      <main>
        <section className={styles.hero}>
          <div className={styles.badge}>✨ V2.0 PRO 출시</div>
          <h1 className={styles.title}>
            당신의 인스타그램,<br />
            <span>AI가 디자인합니다</span>
          </h1>
          <p className={styles.subtitle}>
            좋아하는 계정의 스타일을 분석하고, 주제만 입력하면<br />
            전문가 수준의 카드뉴스가 즉시 완성됩니다. 10배 더 빠른 콘텐츠 제작을 경험하세요.
          </p>
          <div className={styles.ctaGroup}>
            <Link href="/dashboard" className={`btn-primary ${styles.mainBtn}`}>
              무료로 시작하기
            </Link>
            <button className={`btn-secondary ${styles.secondaryBtn}`}>
              사용 방법 보기
            </button>
          </div>
        </section>

        <section className={styles.preview}>
          <div className={styles.previewInner}>
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=1200" alt="Dashboard Preview" className={styles.previewImg} />
             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Link href="/dashboard" className="btn-primary" style={{ padding: '20px 40px', fontSize: '1.2rem' }}>
                   대시보드 체험하기
                </Link>
             </div>
          </div>
        </section>

        <section id="showcase" className={styles.showcase}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>AI 제작 쇼케이스</h2>
            <p className={styles.sectionDesc}>실제 사용자들이 CarNews Insta로 생성한 고퀄리티 카드뉴스입니다. 클릭하여 직접 제작해 보세요.</p>
          </div>
          <div className={styles.showcaseGrid}>
            {[
              { img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=600", title: "2026 UX Trend" },
              { img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=600", title: "Porsche Review" },
              { img: "https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80&w=600", title: "Minimal Marketing" },
              { img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=600", title: "AI-Native Design" }
            ].map((item, idx) => (
              <Link href="/dashboard" key={idx} className={styles.showcaseItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.img} alt={item.title} className={styles.showcaseImg} />
                <div className={styles.showcaseOverlay}>
                  <span>{item.title} - 제작하기</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="features" className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧠</div>
            <h3 className={styles.featureTitle}>스타일 학습 AI</h3>
            <p className={styles.featureDesc}>
              인스타그램 URL 하나로 폰트, 컬러, 레이아웃 에스테틱을 완벽하게 분석하고 학습합니다.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚡</div>
            <h3 className={styles.featureTitle}>초고속 자동 생성</h3>
            <p className={styles.featureDesc}>
              주제만 입력하세요. GPT Image-2와 DALL·E 3가 결합되어 가장 트렌디한 배경을 10초 내에 생성합니다.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎨</div>
            <h3 className={styles.featureTitle}>스마트 에디터</h3>
            <p className={styles.featureDesc}>
              생성된 결과물 위에 텍스트와 요소를 자유롭게 배치하고 수정하세요. 디자인은 AI가, 디테일은 당신이.
            </p>
          </div>
        </section>

        <section id="pricing" className={styles.pricing}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>합리적인 요금제</h2>
            <p className={styles.sectionDesc}>당신의 콘텐츠 창작 속도에 맞춰 선택하세요.</p>
          </div>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planName}>Starter</div>
              <div className={styles.planPrice}>₩0 <span>/ 월</span></div>
              <ul className={styles.planFeatures}>
                <li>월 5회 AI 생성</li>
                <li>기본 템플릿 라이브러리</li>
                <li>표준 화질 다운로드</li>
              </ul>
              <Link href="/dashboard" className="btn-secondary">시작하기</Link>
            </div>
            <div className={`${styles.pricingCard} ${styles.featuredPlan}`}>
              <div className={styles.planBadge}>추천</div>
              <div className={styles.planName}>Pro</div>
              <div className={styles.planPrice}>₩19,000 <span>/ 월</span></div>
              <ul className={styles.planFeatures}>
                <li>무제한 AI 생성</li>
                <li>커스텀 스타일 학습 기능</li>
                <li>4K 초고화질 다운로드</li>
                <li>우선 순위 지원</li>
              </ul>
              <Link href="/dashboard" className="btn-primary">무료 체험하기</Link>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.planName}>Business</div>
              <div className={styles.planPrice}>₩49,000 <span>/ 월</span></div>
              <ul className={styles.planFeatures}>
                <li>Pro의 모든 기능</li>
                <li>팀 프로젝트 협업</li>
                <li>API 액세스 권한</li>
                <li>1:1 디자인 컨설팅</li>
              </ul>
              <Link href="/dashboard" className="btn-secondary">문의하기</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>&copy; 2026 CarNews Insta. All rights reserved.</p>
        <p style={{ marginTop: '12px' }}>Built for the next generation of creators.</p>
      </footer>
    </div>
  );
}
