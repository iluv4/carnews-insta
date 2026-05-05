'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CardGenerator.module.css';
import TemplateCard from './TemplateCard';
import dynamic from 'next/dynamic';
import { useSession, signIn } from 'next-auth/react';
import { useTab } from '@/context/TabContext';
import PortalDashboard from './PortalDashboard';

const CanvasEditor = dynamic(() => import('./CanvasEditor'), { 
  ssr: false,
  loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>에디터 로딩 중...</div>
});

interface Template {
  id: string;
  name: string;
  content: string;
  thumbnail?: string;
  user?: { name: string; image: string };
}

export default function CardGenerator() {
  const { data: session } = useSession();
  const { activeTab, setActiveTab } = useTab();
  
  // Navigation & Stepper State
  const [currentStep, setCurrentStep] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

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
  const [referenceImageBase64, setReferenceImageBase64] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'creative' | 'strict'>('creative');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const industryExamples = [
    { name: '부암동 맛집', url: 'https://www.instagram.com/p/DX6yodgiceN/' },
    { name: '병원/의료', url: 'https://www.instagram.com/p/DXVWOHIDyEy/' },
    { name: '보험/금융', url: 'https://www.instagram.com/p/DXtZaX8EduP/' },
    { name: '화장품/뷰티', url: 'https://www.instagram.com/p/DVFHGrakybK/' },
    { name: '식당(성수)', url: 'https://www.instagram.com/p/DWqmSYbiT-X/' },
    { name: '커피/카페', url: 'https://www.instagram.com/p/DXTdPJvks-J/' },
    { name: '무신사(커머스)', url: 'https://www.instagram.com/p/B_j5fU-gjbz/' },
    { name: '테크(마우스)', url: 'https://www.instagram.com/p/DXQpKowoCsj/' },
  ];

  const loadingTips = [
    "Tip: 인스타그램 카드뉴스는 첫 장의 훅(Hook) 문구가 가장 중요합니다.",
    "Tip: 고대비 색상 조합은 가독성을 높여 이탈률을 줄여줍니다.",
    "Tip: 카드뉴스 본문은 1~2줄의 짧은 문장이 가장 잘 읽힙니다.",
    "Tip: 마지막 슬라이드에 명확한 CTA(Call to Action)를 넣어보세요."
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

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
      setStatusText('추출 완료!');
      return data.images;
    } catch (error: any) {
      setStatusText(`Error: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (specificImg?: string) => {
    const imgUrl = specificImg || extractedImages[selectedImageIndex];
    if (!imgUrl) return;

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
      // 1. Convert image to Base64 via proxy to bypass CORS/NotSameOrigin
      const isInstagramUrl = imgUrl.includes('instagram.com') || imgUrl.includes('cdninstagram.com');
      const proxyUrl = isInstagramUrl ? `/api/proxy?url=${encodeURIComponent(imgUrl)}` : imgUrl;

      const base64Image = await new Promise<string>((resolve, reject) => {
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
          // If streaming proxy fails, try the server-side base64 proxy as a hard fallback
          fetch(`/api/proxy/base64?url=${encodeURIComponent(imgUrl)}`)
            .then(res => res.json())
            .then(data => data.base64 ? resolve(data.base64) : reject(new Error('이미지 로딩 최종 실패')))
            .catch(() => reject(new Error('이미지 로드에 최종 실패했습니다.')));
        };
      });

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: base64Image }),
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error);
      
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setProgress(100);
      setJsonlData(data.analysis);
      setReferenceImageBase64(base64Image);
      setStatusText('스타일 학습 완료!');
      return data.analysis;
    } catch (error: any) {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOneClickAnalyze = async (url: string) => {
    setInstagramUrl(url);
    setJsonlData(''); // Clear old data
    setCurrentStep(2); 
    setAnalyzing(true);
    setStatusText('AI가 스타일을 실시간 학습 중입니다. 잠시만 기다려주세요...');
    
    try {
      const images = await handleFetchImages(url);
      if (images && images.length > 0) {
        setSelectedImageIndex(0);
        const analysis = await handleAnalyze(images[0]);
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
      setCurrentStep(0); // Error? Go back to retry
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!jsonlData && !selectedTemplateId) return;
    setGenerating(true);
    setProgress(0);
    // Go to step 3 immediately with empty slots
    setResultImages(['', '', '']);
    setCurrentStep(3);

    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonlAnalysis: jsonlData || templates.find(t => t.id === selectedTemplateId)?.content,
          theme,
          referenceImageBase64,
        }),
      });

      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const { index, url, error } = JSON.parse(line.slice(6));
            if (url) {
              setResultImages(prev => {
                const next = [...prev];
                next[index] = url;
                return next;
              });
              setProgress(Math.round(((index + 1) / 3) * 100));
              setStatusText(`슬라이드 ${index + 1}/3 완료`);
            }
            if (error) console.error(`Slide ${index} error:`, error);
          } catch {}
        }
      }
    } catch (err) { console.error(err); }
    finally {
      setGenerating(false);
      setStatusText('');
    }
  };

  const steps = [
    { title: '스타일 선택', completed: !!selectedTemplateId || !!jsonlData },
    { title: '스타일 학습', completed: !!jsonlData },
    { title: '내용 입력', completed: !!theme },
    { title: '편집 및 저장', completed: resultImages.length > 0 }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.stepper}>
          {steps.map((s, i) => (
            <div key={i} className={`${styles.step} ${currentStep === i ? styles.activeStep : ''}`}>
              <div className={styles.stepCircle}>{s.completed ? '✓' : i + 1}</div>
              <span className={styles.stepTitle}>{s.title}</span>
            </div>
          ))}
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
                    {industryExamples.map(ex => (
                      <button key={ex.name} className={styles.modernChip} onClick={() => handleOneClickAnalyze(ex.url)}>
                        <span className={styles.chipIcon}>
                          {ex.name.includes('부암동') ? '🍲' : 
                           ex.name.includes('병원') ? '🏥' : 
                           ex.name.includes('보험') ? '🛡️' : 
                           ex.name.includes('화장품') ? '💄' : 
                           ex.name.includes('식당') ? '🍕' : 
                           ex.name.includes('커피') ? '☕' : 
                           ex.name.includes('무신사') ? '👕' : '🖱️'}
                        </span>
                        {ex.name}
                      </button>
                    ))}
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
                <div className={styles.actionGroup}>
                  <button className="btn-secondary" onClick={() => setCurrentStep(0)}>← 스타일 재선택</button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={generating || !jsonlData}>
                    {generating ? '생성 중...' : 'AI 카드뉴스 생성'}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className={styles.editorView}>
                <div className={styles.editorHeader}>
                  <button className="btn-secondary" onClick={() => { setCurrentStep(2); setGenerating(false); }}>← 다시 생성</button>
                  <h2 className={styles.sectionTitle}>
                    {generating ? `생성 중... (${progress}%)` : '생성 완료 🎉'}
                  </h2>
                </div>
                {generating && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: '#f1f5f9', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', height: '100%', width: `${progress}%`, transition: 'width 0.5s ease', borderRadius: 99 }} />
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>
                      {statusText || '슬라이드를 순서대로 생성하고 있어요. 완료된 카드부터 바로 확인할 수 있습니다.'}
                    </p>
                  </div>
                )}
                <div className={styles.imageGrid}>
                  {resultImages.map((img, i) => (
                    <div key={i} className={styles.imageItem} style={{ position: 'relative' }}>
                      {img ? (
                        <img
                          src={img}
                          alt={`슬라이드 ${i + 1}`}
                          style={{ width: '100%', borderRadius: 12, cursor: 'zoom-in' }}
                          onClick={() => setLightboxImg(img)}
                        />
                      ) : (
                        <div style={{
                          width: '100%', aspectRatio: '2/3', borderRadius: 12,
                          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.5s infinite',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: 8, color: '#94a3b8',
                        }}>
                          <div style={{ fontSize: 32 }}>✨</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>슬라이드 {i + 1} 생성 중...</div>
                        </div>
                      )}
                      {img && <button
                        className={styles.modernBtn}
                        style={{ display: 'block', width: '100%', marginTop: 8 }}
                        onClick={() => {
                          const byteString = atob(img.split(',')[1]);
                          const mime = img.split(',')[0].split(':')[1].split(';')[0];
                          const ab = new ArrayBuffer(byteString.length);
                          const ia = new Uint8Array(ab);
                          for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
                          const blob = new Blob([ab], { type: mime });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `cardnews_slide_${i + 1}.png`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        슬라이드 {i + 1} 저장
                      </button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {statusText && <div className={styles.toast}>{statusText}</div>}

      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxImg}
            alt="확대"
            style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: 12, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
