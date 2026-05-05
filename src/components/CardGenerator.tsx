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
    const imgToAnalyze = specificImg || extractedImages[selectedImageIndex];
    if (!imgToAnalyze) return;

    setAnalyzing(true);
    setProgress(0);
    setStatusText('이미지 최적화 중...');
    
    // Simulated progress bar logic
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + Math.random() * 5 : prev));
    }, 400);

    const statusRotation = [
      '🧬 이미지 데이터 구조화 중...',
      '🎨 브랜드 에스테틱 동기화 중...',
      '📐 전문가용 레이아웃 패턴 학습 중...',
      '✒️ 프리미엄 타이포그래피 분석 중...',
      '✨ 디자인 완성도 정밀 검증 중...'
    ];
    let statusIdx = 0;
    const statusInterval = setInterval(() => {
      setStatusText(statusRotation[statusIdx % statusRotation.length]);
      statusIdx++;
    }, 1500);
    
    try {
      // 1. Fetch image via proxy and compress it to Base64 (with retry)
      const compressedImage = await new Promise<string>((resolve, reject) => {
        const tryLoad = (useProxy: boolean) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = useProxy 
            ? `/api/proxy?url=${encodeURIComponent(imgToAnalyze)}`
            : imgToAnalyze; // Try direct if proxy fails
            
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          
          img.onerror = () => {
            if (useProxy) {
              console.warn('Proxy load failed, trying direct...');
              tryLoad(false); // Try direct as fallback
            } else {
              reject(new Error('이미지 로드에 최종 실패했습니다. 다른 링크를 시도해 주세요.'));
            }
          };
        };

        tryLoad(true); // Start with proxy
      });

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: compressedImage })
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error);
      
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      setProgress(100);
      setJsonlData(data.analysis);
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
    
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonlAnalysis: jsonlData || templates.find(t => t.id === selectedTemplateId)?.content,
          theme,
          reference: generationMode
        })
      });
      const data = await res.json();
      if (data.transformedUrls) {
        setResultImages(data.transformedUrls);
        setCurrentStep(3);
      }
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
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
                  <div className={styles.imageGrid}>
                    {extractedImages.map((img, i) => (
                      <div 
                        key={i} 
                        className={`${styles.imageItem} ${selectedImageIndex === i ? styles.selectedImg : ''}`}
                        onClick={() => setSelectedImageIndex(i)}
                      >
                        <img src={img} alt="Reference" />
                      </div>
                    ))}
                    <div className={styles.actionGroup}>
                       <button className="btn-secondary" onClick={() => { setExtractedImages([]); setInstagramUrl(''); }}>초기화</button>
                       <button className="btn-primary" onClick={() => handleAnalyze().then(() => setCurrentStep(2))}>이 스타일로 분석하기</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className={styles.view}>
                <h2 className={styles.sectionTitle}>카드뉴스 내용 입력</h2>
                <div className={styles.formGroup}>
                  <label className="label">적용된 스타일</label>
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
                      '✨ 커스텀 디자인 DNA (학습됨)'
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
                  <button className="btn-secondary" onClick={() => setCurrentStep(2)}>← 내용 수정하기</button>
                  <h2 className={styles.sectionTitle}>최종 편집 및 저장</h2>
                </div>
                <CanvasEditor imageUrl={resultImages[currentSlide]} />
                <div className={styles.pagination}>
                  {resultImages.map((_, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)} className={currentSlide === i ? styles.active : ''}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {statusText && <div className={styles.toast}>{statusText}</div>}
    </div>
  );
}
