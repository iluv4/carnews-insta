'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useTab } from '@/context/TabContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { data: session } = useSession();
  const { activeTab, setActiveTab } = useTab();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.logo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo" className={styles.logoImg} />
        <span className={styles.logoText}>CarNews <span className={styles.accent}>Insta</span></span>
      </Link>

      <nav className={styles.navMenu}>
        <div className={styles.navDivider}>클라이언트 포털</div>
        <div className={styles.portalLinks}>
          <div
            className={`${styles.portalItem} ${activeTab === 'portal-sosohan' ? styles.activePortal : ''}`}
            onClick={() => setActiveTab('portal-sosohan')}
          >
            <span className={styles.portalIcon}>🍃</span> 소소한풍경
          </div>
          <div
            className={`${styles.portalItem} ${activeTab === 'portal-insurance' ? styles.activePortal : ''}`}
            onClick={() => setActiveTab('portal-insurance')}
          >
            <span className={styles.portalIcon}>🛡️</span> 보험 설계 프로
          </div>
          <div
            className={`${styles.portalItem} ${activeTab === 'portal-beauty' ? styles.activePortal : ''}`}
            onClick={() => setActiveTab('portal-beauty')}
          >
            <span className={styles.portalIcon}>💄</span> 럭셔리 뷰티
          </div>
          <div
            className={`${styles.portalItem} ${activeTab === 'portal-studio' ? styles.activePortal : ''}`}
            onClick={() => setActiveTab('portal-studio')}
          >
            <span className={styles.portalIcon}>📸</span> 감성 스튜디오
          </div>
        </div>
      </nav>

      <div className={styles.sidebarFooter}>
        {session ? (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={session.user?.image || ''} alt={session.user?.name || ''} className={styles.avatar} />
              <div className={styles.userDetails}>
                <p className={styles.userName}>{session.user?.name}</p>
                <button onClick={() => signOut()} className={styles.signOutBtn}>로그아웃</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => signIn('google')} className={styles.signInBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-1.94 5.26-7.84 5.26-5.09 0-9.24-4.22-9.24-9.42s4.15-9.42 9.24-9.42c2.9 0 4.84 1.24 5.95 2.3l2.61-2.52C19.34 1.9 16.05 0 12.48 0 5.58 0 0 5.58 0 12.5s5.58 12.5 12.48 12.5c7.21 0 12-5.08 12-12.22 0-.82-.09-1.44-.21-2.06H12.48z"/>
            </svg>
            구글 로그인
          </button>
        )}
      </div>
    </aside>
  );
}
