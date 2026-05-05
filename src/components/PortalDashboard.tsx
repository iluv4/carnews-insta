'use client';

import React from 'react';
import styles from './PortalDashboard.module.css';

interface PortalConfig {
  id: string;
  name: string;
  theme: string;
  accent: string;
  icon: string;
  description: string;
  quickTips: string[];
  referenceLink: string;
}

const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  'portal-buamdong': {
    id: 'buamdong',
    name: '부암동 맛집 전용 스튜디오',
    theme: '#FFF9F5',
    accent: '#FF7E33',
    icon: '🍲',
    description: '부암동의 고즈넉한 감성과 맛있는 온기를 담은 카드뉴스를 제작합니다.',
    quickTips: [
      '음식 사진은 따뜻한 톤의 조명이 핵심입니다.',
      '부암동의 정갈한 분위기에 맞는 명조체 계열 폰트를 추천합니다.',
      '메뉴의 식재료와 정성을 강조하는 문구를 넣어보세요.'
    ],
    referenceLink: 'https://www.instagram.com/p/DX6yodgiceN/'
  },
  'portal-insurance': {
    id: 'insurance',
    name: '보험 설계 프로 매니저',
    theme: '#F5F9FF',
    accent: '#0052CC',
    icon: '🛡️',
    description: '고객의 신뢰를 얻는 전문적이고 명확한 금융 정보를 전달합니다.',
    quickTips: [
      '신뢰감을 주는 블루/네이비 컬러를 주색상으로 사용하세요.',
      '가독성이 높은 고딕(Pretendard) 폰트를 권장합니다.',
      '복잡한 보험 정보는 Q&A나 체크리스트 형식으로 요약하세요.'
    ],
    referenceLink: 'https://www.instagram.com/p/DXtZaX8EduP/'
  },
  'portal-beauty': {
    id: 'beauty',
    name: '럭셔리 뷰티/코스메틱 스튜디오',
    theme: '#FFF5F8',
    accent: '#D41E5E',
    icon: '💄',
    description: '브랜드의 고급스러운 이미지와 제품의 에스테틱을 극대화합니다.',
    quickTips: [
      '충분한 여백(White Space)을 활용하여 고급스러움을 강조하세요.',
      '파스텔 톤과 골드 포인트를 적절히 섞어보세요.',
      '제품의 텍스처나 성분을 강조하는 클로즈업 이미지가 효과적입니다.'
    ],
    referenceLink: 'https://www.instagram.com/p/DVFHGrakybK/'
  },
  'portal-studio': {
    id: 'studio',
    name: '감성 스튜디오/사진관 포트폴리오',
    theme: '#F8F8F8',
    accent: '#333333',
    icon: '📸',
    description: '작가의 철학이 담긴 사진이 주인공이 되는 예술적인 카드뉴스를 만듭니다.',
    quickTips: [
      '사진 자체가 돋보이도록 디자인은 최대한 미니멀하게 유지하세요.',
      '고대비(B&W) 또는 필름 감성의 필터를 배경으로 활용해 보세요.',
      '촬영 정보나 작가의 한마디를 세련된 폰트로 작게 배치해 보세요.'
    ],
    referenceLink: 'https://www.instagram.com/p/DXTdPJvks-J/'
  }
};

interface PortalDashboardProps {
  portalId: string;
  onStart: (url: string) => void;
}

export default function PortalDashboard({ portalId, onStart }: PortalDashboardProps) {
  const config = PORTAL_CONFIGS[portalId];
  if (!config) return null;

  return (
    <div className={styles.portalContainer} style={{ backgroundColor: config.theme }}>
      <div className={styles.portalHero}>
        <div className={styles.portalBadge} style={{ backgroundColor: config.accent + '15', color: config.accent }}>
          {config.icon} {config.name}
        </div>
        <h1 className={styles.portalTitle}>
          {config.name.split(' ').map((word, i) => (
            <span key={i} style={word === '전용' || word === '프로' || word === '럭셔리' || word === '감성' ? { color: config.accent } : {}}>
              {word}{' '}
            </span>
          ))}
        </h1>
        <p className={styles.portalDesc}>{config.description}</p>
        
        <button 
          className="btn-primary" 
          style={{ 
            backgroundColor: config.accent, 
            padding: '20px 48px', 
            fontSize: '1.2rem',
            boxShadow: `0 10px 25px ${config.accent}40`,
            border: 'none',
            marginTop: '16px'
          }}
          onClick={() => onStart(config.referenceLink)}
        >
          {config.icon} 맞춤형 AI 제작 시작하기
        </button>
      </div>

      <div className={styles.portalGrid}>
        <div className={styles.portalCard}>
          <h3 className={styles.cardLabel}>💡 전문가의 팁</h3>
          <ul className={styles.tipList}>
            {config.quickTips.map((tip, i) => (
              <li key={i} style={{ '--primary': config.accent } as React.CSSProperties}>{tip}</li>
            ))}
          </ul>
        </div>
        
        <div className={styles.portalCard}>
          <h3 className={styles.cardLabel}>✨ 이번 주 추천 스타일</h3>
          <div className={styles.recommendedLink}>
            <p>현재 업종에서 가장 반응이 좋은 레퍼런스입니다.</p>
            <code className={styles.linkCode}>{config.referenceLink}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
