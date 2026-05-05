'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CardGenerator.module.css';
import TemplateCard from './TemplateCard';
import { useSession, signIn } from 'next-auth/react';
import { useTab } from '@/context/TabContext';
import PortalDashboard from './PortalDashboard';


interface Template {
  id: string;
  name: string;
  content: string;
  thumbnail?: string;
  user?: { name: string; image: string };
}

const SOSOHAN_URL = 'https://www.instagram.com/sosohanpoonggyeong/';

function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').split('?')[0].toLowerCase();
}

export default function CardGenerator() {
  const { data: session } = useSession();
  const { activeTab, setActiveTab } = useTab();

  // Navigation & Stepper State
  const [currentStep, setCurrentStep] = useState(0);

  // UI States
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Data States
  const [instagramUrl, setInstagramUrl] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [jsonlData, setJsonlData] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'creative' | 'strict'>('creative');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [examplePreviews, setExamplePreviews] = useState<Record<string, string>>({});
  const [clientAnalysisCache, setClientAnalysisCache] = useState<Record<string, string>>({});

  const generatingStartRef = useRef<number>(0);

  const industryExamples = [
    { name: '식품', url: 'https://www.instagram.com/p/DWiwH4cAbZP/' },
    { name: '소소한풍경', url: SOSOHAN_URL },
  ];

  const loadingTips = [
    "Tip: 인스타그램 카드뉴스는 첫 장의 훅(Hook) 문구가 가장 중요합니다.",
    "Tip: 고대비 색상 조합은 가독성을 높여 이탈률을 줄여줍니다.",
    "Tip: 카드뉴스 본문은 1~2줄의 짧은 문장이 가장 잘 읽힙니다.",
    "Tip: 마지막 슬라이드에 명확한 CTA(Call to Action)를 넣어보세요.",
    "Tip: GPT-Image-2가 레퍼런스 스타일을 정밀 학습하는 중입니다...",
  ];

  useEffect(() => {
    fetchTemplates();
    fetchExamplePreviews();
    preloadSosohanImages();
  }, []);

  useEffect(() => {
    if (!generating) return;
    generatingStartRef.current = Date.now();
    setElapsedSeconds(0);
    setCurrentTipIndex(0);
    const tipT = setInterval(() => setCurrentTipIndex(i => (i + 1) % loadingTips.length), 3500);
    const elapsedT = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generatingStartRef.current) / 1000));
    }, 1000);
    return () => { clearInterval(tipT); clearInterval(elapsedT); };
  }, [generating]);

  // Pre-load sosohanpoonggyeong images as default "my photos"
  const preloadSosohanImages = async () => {
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: SOSOHAN_URL }),
      });
      const data = await res.json();
      if (data.images?.length > 0) {
        // Convert first 5 to base64 in background
        const urls = data.images.slice(0, 5);
        const settled = await Promise.allSettled(urls.map(imgUrlToBase64));
        const b64s = settled
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value);
        if (b64s.length > 0) {
          setReferenceImages(b64s);
          console.log(`[sosohan] pre-loaded ${b64s.length} images`);
        }
      }
    } catch (e) {
      console.error('[sosohan preload]', e);
    }
  };

  const fetchExamplePreviews = async () => {
    const results = await Promise.allSettled(
      industryExamples.map(ex =>
        fetch('/api/instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ex.url }),
        })
          .then(r => r.json())
          .then(data => ({ url: ex.url, img: data.images?.[0] || null }))
      )
    );
    const previews: Record<string, string> = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.img) {
        previews[r.value.url] = r.value.img;
      }
    });
    setExamplePreviews(previews);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) { console.error(err); }
  };

  const handleFetchImages = async (urlToFetch?: string) => {
    const url = urlToFetch || instagramUrl;
    if (!url) return null;

    setLoading(true);
    setStatusText('인스타그램 미디어 추출 중...');

    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExtractedImages(data.images);
      setSelectedImageIndex(0);
      setStatusText(`${data.images.length}장 추출 완료! 다운로드 중...`);

      // Auto-download ALL images from the post
      data.images.forEach((imgUrl: string, i: number) => {
        setTimeout(() => autoDownload(imgUrl, `reference-${i + 1}.jpg`), i * 300);
      });

      setStatusText(`${data.images.length}장 다운로드 완료!`);
      return data.images;
    } catch (error: any) {
      setStatusText(`Error: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const imgUrlToBase64 = (imgUrl: string): Promise<string> => {
    const isInstagramUrl = imgUrl.includes('instagram.com') || imgUrl.includes('cdninstagram.com');
    const proxyUrl = isInstagramUrl ? `/api/proxy?url=${encodeURIComponent(imgUrl)}` : imgUrl;

    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = proxyUrl;

      img.onload = () => {
        const MAX_SIZE = 1024;
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        fetch(`/api/proxy/base64?url=${encodeURIComponent(imgUrl)}`)
          .then(res => res.json())
          .then(data => data.base64 ? resolve(data.base64) : reject(new Error('이미지 로딩 최종 실패')))
          .catch(() => reject(new Error('이미지 로드에 최종 실패했습니다.')));
      };
    });
  };

  const handleAnalyze = async (specificImgs?: string[]) => {
    const imgList = specificImgs || extractedImages;
    if (!imgList || imgList.length === 0) return;

    setAnalyzing(true);
    setProgress(0);
    setStatusText('AI가 디자인 DNA 분석 중...');

    const statusRotation = ['브랜드 컬러 추출 중...', '타이포그래피 패턴 분석 중...', '레이아웃 에스테틱 동기화 중...', '시각적 계층 구조 학습 중...'];
    let statusIdx = 0;
    const statusInterval = setInterval(() => {
      setStatusText(statusRotation[statusIdx % statusRotation.length]);
      statusIdx++;
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + (100 - prev) * 0.1, 98));
    }, 400);

    try {
      setStatusText('레퍼런스 이미지 다운로드 중...');
      const settled = await Promise.allSettled(imgList.slice(0, 5).map(imgUrlToBase64));
      const base64Images = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

      console.log(`[analyze] ${base64Images.length}/${Math.min(imgList.length, 5)} images converted`);

      if (base64Images.length === 0) {
        throw new Error('이미지를 로드할 수 없습니다. 다시 시도해주세요.');
      }

      setStatusText(`${base64Images.length}장 이미지 AI 분석 중...`);

      const cacheKey = instagramUrl || undefined;
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: base64Images, cacheKey }),
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error || '분석 오류');

      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setProgress(100);
      setJsonlData(data.analysis);

      // Save to client-side analysis cache
      if (cacheKey) {
        setClientAnalysisCache(prev => ({ ...prev, [normaliseUrl(cacheKey)]: data.analysis }));
      }

      setStatusText(data.cached ? '✅ 캐시된 분석 결과 사용 (빠른 로드)' : '스타일 학습 완료!');
      return data.analysis;
    } catch (error: any) {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      console.error('[analyze error]', error);
      setStatusText(`분석 실패: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOneClickAnalyze = async (url: string) => {
    // Check client-side cache first — skip re-analysis if already done
    const cached = clientAnalysisCache[normaliseUrl(url)];
    if (cached) {
      setInstagramUrl(url);
      setJsonlData(cached);
      setCurrentStep(2);
      setStatusText('✅ 이미 분석된 스타일 — 바로 적용!');
      return;
    }

    setInstagramUrl(url);
    setJsonlData('');
    setCurrentStep(2);
    setAnalyzing(true);
    setStatusText('AI가 스타일을 실시간 학습 중입니다. 잠시만 기다려주세요...');

    try {
      const images = await handleFetchImages(url);
      if (images && images.length > 0) {
        setSelectedImageIndex(0);
        const analysis = await handleAnalyze(images);
        if (analysis) {
          setStatusText('맞춤형 스타일 학습 완료! 내용을 입력하세요.');
        } else {
          throw new Error('디자인 분석에 실패했습니다.');
        }
      } else {
        throw new Error('인스타그램 미디어를 가져오지 못했습니다.');
      }
    } catch (err: any) {
      setStatusText(`오류: ${err.message}`);
      setCurrentStep(0);
    } finally {
      setAnalyzing(false);
    }
  };

  const autoDownload = async (url: string, filename: string) => {
    try {
      let href = url;
      if (!url.startsWith('data:')) {
        const isInstagram = url.includes('instagram.com') || url.includes('cdninstagram.com');
        const fetchUrl = isInstagram ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
      }
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!url.startsWith('data:')) URL.revokeObjectURL(href);
    } catch (e) {
      console.error('Auto-download failed:', e);
    }
  };

  const handleDownloadOnly = async (url: string) => {
    setLoading(true);
    setStatusText('이미지 가져오는 중...');
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const images: string[] = data.images || [];
      setStatusText(`${images.length}장 다운로드 중...`);
      images.forEach((imgUrl, i) => {
        setTimeout(() => autoDownload(imgUrl, `sosohan-${i + 1}.jpg`), i * 300);
      });
      setStatusText(`✅ ${images.length}장 다운로드 완료!`);
    } catch (e: any) {
      setStatusText(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!jsonlData && !selectedTemplateId) return;
    setGenerating(true);
    setProgress(0);
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonlAnalysis: jsonlData || templates.find(t => t.id === selectedTemplateId)?.content,
          theme,
          reference: generationMode,
          referenceImageBase64: referenceImages[0] || '',
        })
      });
      const data = await res.json();
      if (data.transformedUrls) {
        setResultImages(data.transformedUrls);
        setCurrentStep(3);
        // Auto-download all slides
        const labels = ['cover', 'content', 'closing'];
        data.transformedUrls.forEach((url: string, i: number) => {
          setTimeout(() => autoDownload(url, `cardnews-${labels[i]}.png`), i * 400);
        });
      }
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  const handleAddReferenceImages = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target?.result as string;
        if (b64) setReferenceImages(prev => [...prev, b64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReferenceImage = (idx: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== idx));
  };

  const steps = [
    { title: '스타일 선택', completed: !!selectedTemplateId || !!jsonlData },
    { title: '스타일 학습', completed: !!jsonlData },
    { title: '내용 입력', completed: !!theme },
    { title: '편집 및 저장', completed: resultImages.length > 0 }
  ];

  const navigableSteps: Record<number, number> = { 0: 0, 1: 0, 2: 2, 3: 3 };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.stepper}>
          {steps.map((s, i) => {
            const targetStep = navigableSteps[i] ?? i;
            return (
              <div
                key={i}
                className={`${styles.step} ${currentStep === i ? styles.activeStep : ''} ${s.completed ? styles.completedStep : ''}`}
                onClick={() => setCurrentStep(targetStep)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.stepCircle}>{s.completed ? '✓' : i + 1}</div>
                <span className={styles.stepTitle}>{s.title}</span>
              </div>
            );
          })}
        </div>
      </header>

      <div className={styles.content}>
        {activeTab.startsWith('portal-') ? (
          <PortalDashboard
            portalId={activeTab}
            onStart={(url) => handleOneClickAnalyze(url)}
          />
        ) : (
          <>
            {currentStep === 0 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>인스타그램 스타일 학습</h2>
                  <p className={styles.sectionDesc}>분석하고 싶은 포스트 URL을 입력하세요. AI가 디자인 에스테틱을 추출합니다.</p>
                </div>

                <div className={styles.urlInputContainer}>
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputIcon}>🔗</span>
                    <input
                      type="text"
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className={styles.modernInput}
                    />
                  </div>
                  <button className={styles.modernBtn} onClick={() => handleFetchImages()}>
                    {loading ? '추출 중...' : '이미지 분석 시작'}
                  </button>
                </div>

                <div className={styles.quickTests}>
                  <p className={styles.quickLabel}>업종별 빠른 테스트:</p>
                  <div className={styles.chipGrid}>
                    {industryExamples.map(ex => {
                      const preview = examplePreviews[ex.url];
                      const isCached = !!clientAnalysisCache[normaliseUrl(ex.url)];
                      return (
                        <div key={ex.name} className={styles.chipWrapper}>
                          <button className={styles.modernChip} onClick={() => handleOneClickAnalyze(ex.url)}>
                            {preview ? (
                              <img
                                src={`/api/proxy?url=${encodeURIComponent(preview)}`}
                                alt={ex.name}
                                className={styles.chipThumb}
                              />
                            ) : (
                              <span className={styles.chipIcon}>📷</span>
                            )}
                            <span className={styles.chipLabel}>
                              {ex.name}
                              {isCached && <span className={styles.cachedBadge}> ✓</span>}
                            </span>
                          </button>
                          <button
                            className={styles.chipDownloadBtn}
                            onClick={() => handleDownloadOnly(ex.url)}
                            title="이미지만 다운로드"
                          >
                            ↓ 다운로드
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {extractedImages.length > 0 && (
                  <div className={styles.imageSelectorSection}>
                    <h3 className={styles.subTitle}>분석할 이미지를 선택하세요</h3>
                    <div className={styles.imageGrid}>
                      {extractedImages.map((img, i) => (
                        <div
                          key={i}
                          className={`${styles.imageItem} ${selectedImageIndex === i ? styles.selectedImg : ''}`}
                          onClick={() => setSelectedImageIndex(i)}
                        >
                          <img src={`/api/proxy?url=${encodeURIComponent(img)}`} alt="Reference" />
                        </div>
                      ))}
                    </div>
                    <div className={styles.actionGroup}>
                       <button className={styles.secondaryBtn} onClick={() => { setExtractedImages([]); setInstagramUrl(''); }}>초기화</button>
                       <button className={styles.modernBtn} onClick={() => handleAnalyze().then(() => setCurrentStep(2))}>선택한 스타일 분석 시작</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>카드뉴스 내용 입력</h2>
                  <p className={styles.sectionDesc}>방금 학습한 디자인 DNA를 바탕으로 새로운 카드를 만듭니다.</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.modernLabel}>적용된 스타일</label>
                  <div className={`${styles.styleBadge} ${analyzing ? styles.pulse : ''}`}>
                    {analyzing ? (
                      <div className={styles.analysisProgressWrapper}>
                        <div className={styles.progressTextGroup}>
                          <span className={styles.analyzingText}>{statusText}</span>
                          <span className={styles.progressPercent}>{Math.round(progress)}%</span>
                        </div>
                        <div className={styles.miniProgressBar}>
                          <div className={styles.miniProgressFill} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    ) : jsonlData ? (
                      <div className={styles.successBadge}>
                        <span className={styles.successIcon}>✨</span>
                        <span className={styles.successText}>커스텀 디자인 DNA 학습 완료</span>
                      </div>
                    ) : (
                      '⚠️ 선택된 스타일 없음 (분석 대기 중...)'
                    )}
                  </div>
                </div>
                <textarea
                  className={styles.textarea}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="부암동 맛집의 핵심 매력을 입력하세요..."
                />

                <div className={styles.formGroup}>
                  <label className={styles.modernLabel}>
                    내 사진
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                      {referenceImages.length > 0
                        ? `${referenceImages.length}장 로드됨 — 생성 시 내 사진 기반으로 적용`
                        : '선택 — 업로드하면 내 사진 기반으로 생성'}
                    </span>
                  </label>

                  {/* Thumbnail grid of loaded reference images */}
                  {referenceImages.length > 0 && (
                    <div className={styles.refThumbsGrid}>
                      {referenceImages.map((b64, idx) => (
                        <div key={idx} className={styles.refThumbWrap}>
                          <img src={b64} alt={`ref-${idx}`} className={styles.refThumb} />
                          <button
                            className={styles.refThumbRemove}
                            onClick={() => handleRemoveReferenceImage(idx)}
                            title="삭제"
                          >×</button>
                        </div>
                      ))}
                      {/* Add more button */}
                      <label className={styles.refThumbAdd} title="사진 추가">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
                        />
                        <span>+</span>
                      </label>
                    </div>
                  )}

                  {referenceImages.length === 0 && (
                    <label className={styles.uploadArea}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
                      />
                      <div className={styles.uploadPlaceholder}>
                        <span style={{ fontSize: '1.8rem' }}>📷</span>
                        <span>클릭해서 내 사진 업로드 (여러 장 가능)</span>
                      </div>
                    </label>
                  )}
                </div>

                <div className={styles.actionGroup}>
                  <button className="btn-secondary" onClick={() => setCurrentStep(0)}>← 스타일 재선택</button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={generating || !jsonlData}>
                    {generating ? '생성 중...' : 'AI 카드뉴스 생성'}
                  </button>
                </div>

              </div>
            )}

            {currentStep === 3 && (
              <div className={styles.wizardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>생성 완료 🎉</h2>
                  <p className={styles.sectionDesc}>각 이미지를 클릭하면 확대해서 볼 수 있어요.</p>
                </div>
                <div className={styles.resultGrid}>
                  {['COVER', 'CONTENT', 'CLOSING'].map((label, i) => (
                    <div key={i} className={styles.resultCard}>
                      <span className={styles.resultLabel}>{label}</span>
                      {resultImages[i] ? (
                        <>
                          <a href={resultImages[i]} target="_blank" rel="noopener noreferrer">
                            <img
                              src={resultImages[i]}
                              alt={label}
                              className={styles.resultImg}
                            />
                          </a>
                          <a
                            href={resultImages[i]}
                            download={`cardnews-${label.toLowerCase()}.png`}
                            className={styles.resultDownloadBtn}
                          >
                            ↓ 다운로드
                          </a>
                        </>
                      ) : (
                        <div className={styles.resultSkeleton} />
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.actionGroup} style={{ marginTop: '32px' }}>
                  <button className="btn-secondary" onClick={() => setCurrentStep(2)}>← 다시 생성하기</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {statusText && <div className={styles.toast}>{statusText}</div>}

      {generating && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingContent}>
            <div className={styles.spinnerRing} />
            <p className={styles.generatingLabel}>AI 카드뉴스 생성 중</p>
            <p className={styles.generatingTheme}>"{theme}"</p>
            <p className={styles.elapsedTime}>
              {Math.floor(elapsedSeconds / 60) > 0
                ? `${Math.floor(elapsedSeconds / 60)}분 ${elapsedSeconds % 60}초 경과`
                : `${elapsedSeconds}초 경과`}
              <span className={styles.elapsedNote}> · 보통 45~90초 소요</span>
            </p>
            <div className={styles.generatingSlots}>
              {['COVER', 'CONTENT', 'CLOSING'].map((label) => (
                <div key={label} className={styles.generatingSlot}>
                  <div className={styles.slotSkeleton} />
                  <span className={styles.slotLabel}>{label}</span>
                </div>
              ))}
            </div>
            <p className={styles.generatingTip}>{loadingTips[currentTipIndex]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
