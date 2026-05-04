'use client';

import React from 'react';
import styles from './TemplateCard.module.css';

interface TemplateCardProps {
  name: string;
  thumbnail?: string;
  creatorName?: string;
  creatorImage?: string;
  onClick: () => void;
  isSelected?: boolean;
}

export default function TemplateCard({ name, thumbnail, creatorName, creatorImage, onClick, isSelected }: TemplateCardProps) {
  return (
    <div className={`${styles.card} ${isSelected ? styles.selected : ''}`} onClick={onClick}>
      <div className={styles.thumbnailWrapper}>
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={name} className={styles.thumbnail} />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <span>{name[0].toUpperCase()}</span>
          </div>
        )}
        {isSelected && <div className={styles.checkBadge}>✓</div>}
      </div>
      <div className={styles.info}>
        <h4 className={styles.name}>{name}</h4>
        {creatorName && (
          <div className={styles.creator}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creatorImage} alt={creatorName} className={styles.creatorAvatar} />
            <span>{creatorName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
