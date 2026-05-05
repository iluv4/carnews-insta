'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type SlideResult = { url: string } | { error: string } | null;

const LABELS = ['COVER', 'CONTENT', 'CLOSING'];

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;
  const [slides, setSlides] = useState<SlideResult[]>([null, null, null]);
  const [theme, setTheme] = useState('');
  const [done, setDone] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/share/${id}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json();
        setSlides(data.slides);
        setTheme(data.theme || '');
        if (data.done) { setDone(true); stopped = true; }
      } catch {}
    };

    poll();
    const interval = setInterval(() => { if (!stopped) poll(); }, 2000);
    return () => { stopped = true; clearInterval(interval); };
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completedCount = slides.filter(s => s !== null && 'url' in s).length;

  if (notFound) {
    return (
      <div style={page}>
        <div style={center}>
          <p style={{ color: '#888', fontSize: '1rem' }}>링크가 만료되었거나 존재하지 않습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div style={logo}>✦ 카드뉴스 AI</div>
        <div style={statusBadge(done)}>
          {done ? '✅ 생성 완료' : `⏳ ${completedCount} / 3 생성 중...`}
        </div>
      </div>

      {/* Title */}
      <div style={titleSection}>
        {theme && <p style={themeLabel}>"{theme}"</p>}
        <h1 style={title}>AI 카드뉴스 생성 중입니다</h1>
        <p style={subtitle}>슬라이드가 완성되는 순서대로 실시간으로 나타납니다</p>
        <button onClick={copyLink} style={copyBtn(copied)}>
          {copied ? '✅ 복사됨!' : '🔗 링크 복사'}
        </button>
      </div>

      {/* Slides */}
      <div style={grid}>
        {slides.map((slide, i) => {
          const isReady = slide !== null && 'url' in slide;
          const hasError = slide !== null && 'error' in slide;
          return (
            <div key={i} style={card}>
              <div style={slideLabel}>{LABELS[i]}</div>
              <div style={slideFrame}>
                {isReady ? (
                  <img
                    src={(slide as { url: string }).url}
                    alt={LABELS[i]}
                    style={slideImg}
                  />
                ) : hasError ? (
                  <div style={errorBox}>생성 실패</div>
                ) : (
                  <div style={skeleton} />
                )}
              </div>
              {isReady && (
                <a
                  href={(slide as { url: string }).url}
                  download={`cardnews-${i + 1}.png`}
                  style={dlBtn}
                >
                  ↓ 다운로드
                </a>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div style={doneMsg}>
          🎉 모든 슬라이드 생성 완료! 클릭해서 다운로드 하세요.
        </div>
      )}
    </div>
  );
}

/* ---- inline styles ---- */
const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
  padding: '0 0 60px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const center: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  height: '100vh',
};

const header: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 40px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const logo: React.CSSProperties = {
  color: '#a78bfa', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em',
};

const statusBadge = (done: boolean): React.CSSProperties => ({
  padding: '6px 16px',
  borderRadius: '999px',
  background: done ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.15)',
  color: done ? '#4ade80' : '#a78bfa',
  fontSize: '0.85rem', fontWeight: 700,
  border: `1px solid ${done ? 'rgba(74,222,128,0.3)' : 'rgba(167,139,250,0.3)'}`,
});

const titleSection: React.CSSProperties = {
  textAlign: 'center', padding: '48px 20px 32px',
};

const themeLabel: React.CSSProperties = {
  color: '#a78bfa', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px',
};

const title: React.CSSProperties = {
  color: '#ffffff', fontSize: '1.75rem', fontWeight: 800,
  margin: '0 0 8px', letterSpacing: '-0.03em',
};

const subtitle: React.CSSProperties = {
  color: '#666', fontSize: '0.9rem', margin: '0 0 24px',
};

const copyBtn = (copied: boolean): React.CSSProperties => ({
  padding: '10px 28px',
  background: copied ? '#16a34a' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  color: '#fff', border: 'none', borderRadius: '12px',
  cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
  transition: 'all 0.2s ease',
});

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '24px',
  maxWidth: '900px',
  margin: '0 auto',
  padding: '0 24px',
};

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '12px',
};

const slideLabel: React.CSSProperties = {
  color: '#555', fontSize: '0.7rem', fontWeight: 800,
  letterSpacing: '0.1em', textAlign: 'center',
};

const slideFrame: React.CSSProperties = {
  borderRadius: '16px', overflow: 'hidden',
  aspectRatio: '2/3', background: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.06)',
};

const slideImg: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
};

const errorBox: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#ef4444', fontSize: '0.85rem',
};

const skeleton: React.CSSProperties = {
  width: '100%', height: '100%',
  background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.6s infinite',
};

const dlBtn: React.CSSProperties = {
  display: 'block', textAlign: 'center',
  padding: '10px',
  background: 'rgba(124,58,237,0.15)',
  color: '#a78bfa',
  borderRadius: '10px',
  textDecoration: 'none',
  fontSize: '0.85rem', fontWeight: 700,
  border: '1px solid rgba(124,58,237,0.25)',
  transition: 'all 0.2s ease',
};

const doneMsg: React.CSSProperties = {
  textAlign: 'center', marginTop: '40px',
  color: '#4ade80', fontSize: '1rem', fontWeight: 700,
};
