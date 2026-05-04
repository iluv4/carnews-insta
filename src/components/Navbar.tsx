'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🏎️</span>
        <span className={styles.logoText}>CarNews <span className={styles.accent}>Insta</span></span>
      </div>
      <div className={styles.navActions}>
        {session ? (
          <div className={styles.userProfile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.user?.image || ''} alt={session.user?.name || ''} className={styles.avatar} />
            <span className={styles.userName}>{session.user?.name}</span>
            <button onClick={() => signOut()} className={styles.signOutBtn}>Logout</button>
          </div>
        ) : (
          <button onClick={() => signIn('google')} className={styles.signInBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-1.94 5.26-7.84 5.26-5.09 0-9.24-4.22-9.24-9.42s4.15-9.42 9.24-9.42c2.9 0 4.84 1.24 5.95 2.3l2.61-2.52C19.34 1.9 16.05 0 12.48 0 5.58 0 0 5.58 0 12.5s5.58 12.5 12.48 12.5c7.21 0 12-5.08 12-12.22 0-.82-.09-1.44-.21-2.06H12.48z"/>
            </svg>
            Login with Google
          </button>
        )}
      </div>
    </nav>
  );
}
