'use client';

import React, { useState, useRef } from 'react';
import styles from './AmazonGenerator.module.css';
import cgStyles from './CardGenerator.module.css';

interface Slide {
  image: string;
  label: string;
}

interface FormState {
  productName: string;
  brand: string;
  ingredients: string;
  benefits: string;
  howToUse: string;
  lang: string;
}

const PHOTO_LABELS = ['메인 제품', '성분/상세', '사용법', 'Before', 'After', '라이프스타일'];
const LANG_OPTIONS = [
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ko', label: '🇰🇷 한국어' },
];
const STEP_LABELS = ['사진 업로드', '제품 정보', '결과 확인'];

export default function AmazonGenerator() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    productName: '',
    brand: '',
    ingredients: '',
    benefits: '',
    howToUse: '',
    lang: 'ja',
  });
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [error, setError] = useState('');

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handlePhotoUpload(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = result;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSlotClick(index: number) {
    fileInputRefs.current[index]?.click();
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handlePhotoUpload(index, file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setLang(lang: string) {
    setForm((prev) => ({ ...prev, lang }));
  }

  async function handleGenerate() {
    if (!form.productName.trim()) {
      setError('제품명을 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/generate-amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          photos: photos.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setSlides(data.slides);
      setStep(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function getDownloadFilename(index: number, label: string): string {
    const slug = label.replace(/\s+/g, '').replace(/&/g, '').replace(/\//g, '-');
    return `amazon-slide-${index + 1}-${slug}.jpg`;
  }

  return (
    <div className={cgStyles.container}>
      <div className={cgStyles.header}>
        <div className={cgStyles.stepper}>
          {STEP_LABELS.map((label, i) => {
            const num = (i + 1) as 1 | 2 | 3;
            const isActive = step === num;
            const isDone = step > num;
            const cls = [
              styles.stepItem,
              isActive ? styles.stepActive : '',
              isDone ? styles.stepDone : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={label} className={cls}>
                <div className={styles.stepCircle}>
                  {isDone ? '✓' : num}
                </div>
                <span className={styles.stepName}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cgStyles.scrollArea}>
        <div className={cgStyles.wizardCard}>

          {/* ── Step 1: Photo Upload ── */}
          {step === 1 && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>제품 사진 업로드</div>
                <div className={styles.stepDesc}>
                  최대 6장 업로드 가능합니다. 메인 제품 사진은 필수입니다.
                </div>
              </div>

              <div className={styles.photoGrid}>
                {PHOTO_LABELS.map((label, i) => {
                  const filled = !!photos[i];
                  return (
                    <div
                      key={label}
                      className={`${styles.photoSlot} ${filled ? styles.photoSlotFilled : ''}`}
                      onClick={() => handleSlotClick(i)}
                    >
                      {filled ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photos[i]} alt={label} />
                          <div className={styles.photoSlotOverlay}>
                            <span className={styles.photoSlotOverlayText}>변경하기</span>
                          </div>
                          <div className={styles.photoSlotBadge}>{label}</div>
                        </>
                      ) : (
                        <>
                          <span className={styles.photoSlotIcon}>
                            {i === 0 ? '📦' : i === 1 ? '🔬' : i === 2 ? '✋' : i === 3 ? '⬅️' : i === 4 ? '➡️' : '🌿'}
                          </span>
                          <span className={styles.photoSlotLabel}>{label}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        ref={(el) => { fileInputRefs.current[i] = el; }}
                        onChange={(e) => handleFileChange(i, e)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className={styles.navBtns}>
                <button
                  className={styles.nextBtn}
                  onClick={() => setStep(2)}
                  disabled={!photos[0]}
                >
                  다음 단계 →
                </button>
              </div>
              {!photos[0] && (
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
                  메인 제품 사진(첫 번째 슬롯)을 업로드해야 다음 단계로 진행할 수 있습니다.
                </p>
              )}
            </>
          )}

          {/* ── Step 2: Product Info ── */}
          {step === 2 && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>제품 정보 입력</div>
                <div className={styles.stepDesc}>
                  AI가 6장의 Amazon 리스팅 이미지 카피를 자동 생성합니다.
                </div>
              </div>

              {/* Language selector */}
              <div className={styles.langSelector}>
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.langBtn} ${form.lang === opt.value ? styles.langBtnActive : ''}`}
                    onClick={() => setLang(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>제품명 *</label>
                  <input
                    className={styles.formInput}
                    name="productName"
                    value={form.productName}
                    onChange={handleFormChange}
                    placeholder="예: 히알루론산 세럼"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>브랜드명</label>
                  <input
                    className={styles.formInput}
                    name="brand"
                    value={form.brand}
                    onChange={handleFormChange}
                    placeholder="예: SKINLAB"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>주요 성분</label>
                <textarea
                  className={styles.formTextarea}
                  name="ingredients"
                  value={form.ingredients}
                  onChange={handleFormChange}
                  placeholder="예: 히알루론산 2%, 나이아신아마이드 5%, 판테놀"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>효능 / 효과</label>
                <textarea
                  className={styles.formTextarea}
                  name="benefits"
                  value={form.benefits}
                  onChange={handleFormChange}
                  placeholder="예: 보습, 미백, 주름 개선, 피부 진정"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>사용 방법</label>
                <textarea
                  className={styles.formTextarea}
                  name="howToUse"
                  value={form.howToUse}
                  onChange={handleFormChange}
                  placeholder="예: 세안 후 토너 사용 전, 적당량을 얼굴에 도포"
                />
              </div>

              {error && <div className={styles.errorBox}>{error}</div>}

              <div className={styles.navBtns}>
                <button className={styles.backBtn} onClick={() => setStep(1)} type="button">
                  ← 이전
                </button>
                <button
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={loading || !form.productName.trim()}
                  type="button"
                >
                  {loading ? (
                    <>
                      <span className={styles.spinnerInline} />
                      AI 생성 중... (약 1분 소요)
                    </>
                  ) : (
                    '🛒 Amazon 이미지 6장 생성'
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Results ── */}
          {step === 3 && (
            <>
              <div className={styles.stepHeader}>
                <div className={styles.stepTitle}>생성 완료 🎉</div>
                <div className={styles.stepDesc}>
                  6장의 Amazon 리스팅 이미지가 생성되었습니다. 각 이미지를 다운로드하세요.
                </div>
              </div>

              <div className={styles.slideGrid}>
                {slides.map((slide, i) => (
                  <div key={i} className={styles.slideCard}>
                    <div className={styles.slideLabel}>
                      {i + 1}. {slide.label}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image}
                      alt={slide.label}
                      className={styles.slideImg}
                    />
                    <a
                      href={slide.image}
                      download={getDownloadFilename(i, slide.label)}
                      className={styles.slideDownloadBtn}
                    >
                      ↓ 다운로드
                    </a>
                  </div>
                ))}
              </div>

              <div className={styles.navBtns} style={{ marginTop: 40 }}>
                <button className={styles.backBtn} onClick={() => setStep(2)} type="button">
                  ← 다시 생성
                </button>
                <button
                  className={styles.nextBtn}
                  onClick={() => {
                    setStep(1);
                    setPhotos([]);
                    setSlides([]);
                    setForm({ productName: '', brand: '', ingredients: '', benefits: '', howToUse: '', lang: 'ja' });
                    setError('');
                  }}
                  type="button"
                >
                  새 제품 시작
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
