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
      </main>

      <footer className={styles.footer}>
        <p>&copy; 2026 CarNews Insta. All rights reserved.</p>
        <p style={{ marginTop: '12px' }}>Built for the next generation of creators.</p>
      </footer>
    </div>
  );
}
