'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CardGenerator.module.css';
import TemplateCard from './TemplateCard';
import dynamic from 'next/dynamic';

const CanvasEditor = dynamic(() => import('./CanvasEditor'), { 
  ssr: false,
  loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>에디터 로딩 중...</div>
});
import { useSession, signIn } from 'next-auth/react';
import { useTab } from '@/context/TabContext';

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
  
  // UI States
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Example Links for Industries
  const industryExamples = [
    { name: '병원', url: 'https://www.instagram.com/p/DXVWOHIDyEy/' },
    { name: '법률', url: 'https://www.instagram.com/p/DXtZaX8EduP/' },
    { name: '식당(성수)', url: 'https://www.instagram.com/p/DX6yodgiceN/' },
    { name: '무신사(커머스)', url: 'https://www.instagram.com/p/DVFHGrakybK/' },
    { name: '커피', url: 'https://www.instagram.com/p/DXTdPJvks-J/' },
    { name: '햄버거(마케팅)', url: 'https://www.instagram.com/p/DWqmSYbiT-X/' },
    { name: '김치', url: 'https://www.instagram.com/p/B_j5fU-gjbz/' },
    { name: '테크(마우스)', url: 'https://www.instagram.com/p/DXQpKowoCsj/' },
  ];

  // Data States
  const [instagramUrl, setInstagramUrl] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [jsonlData, setJsonlData] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Template Library
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');

  // UX Enhancement States
  const [progress, setProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  const loadingTips = [
    "Tip: 인스타그램 카드뉴스는 첫 장의 훅(Hook) 문구가 가장 중요합니다.",
    "Tip: 고대비 색상 조합은 가독성을 높여 이탈률을 줄여줍니다.",
    "Tip: 카드뉴스 본문은 1~2줄의 짧은 문장이 가장 잘 읽힙니다.",
    "Tip: 마지막 슬라이드에 명확한 CTA(Call to Action)를 넣어보세요.",
    "Tip: AI가 학습한 스타일은 브랜드 아이덴티티 유지에 도움을 줍니다.",
    "Tip: 적절한 여백(White Space)은 디자인의 완성도를 높입니다.",
    "Tip: 폰트 크기는 모바일 환경을 고려하여 넉넉하게 설정하세요.",
    "Tip: '저장하기'나 '공유하기'를 유도하는 멘트를 꼭 넣어보세요.",
    "Tip: 일관된 톤앤매너는 계정의 전문성을 높여줍니다.",
    "Tip: AI 생성 이미지는 저작권 걱정 없이 자유롭게 사용 가능합니다."
  ];

  // Progress simulation logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let tipInterval: NodeJS.Timeout;

    if (generating || analyzing || loading) {
      setProgress(0);
      setCurrentTipIndex(Math.floor(Math.random() * loadingTips.length));
      
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) return prev + 2; // Fast start
          if (prev < 70) return prev + 0.5; // Slow down
          if (prev < 95) return prev + 0.1; // Crawl at end
          return prev;
        });
      }, 100);

      tipInterval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % loadingTips.length);
      }, 4000);
    } else {
      setProgress(0);
    }

    return () => {
      clearInterval(interval);
      clearInterval(tipInterval);
    };
  }, [generating, analyzing, loading]);

  // Generation Settings
  const [theme, setTheme] = useState('');
  const [generationMode, setGenerationMode] = useState<'creative' | 'strict'>('creative');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  };

  const handleFetchImages = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    if (!instagramUrl) return;

    setLoading(true);
    setStatusText('인스타그램 미디어 추출 중...');
    setExtractedImages([]);
    setResultImages([]);
    setCurrentSlide(0);
    
    const targetUrl = typeof e === 'string' ? e : instagramUrl;
    if (!targetUrl) return;

    try {
      const igRes = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      const igData = await igRes.json();
      
      if (!igRes.ok) throw new Error(igData.error || 'Failed to fetch IG images');
      
      setExtractedImages(igData.images);
      setStatusText('추출 완료! 학습할 이미지를 선택하세요.');
      setActiveTab('generate');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (extractedImages.length === 0) return;

    setAnalyzing(true);
    setStatusText('이미지 최적화 중...');
    
    try {
      const imageUrl = extractedImages[selectedImageIndex];
      
      // Client-side image compression to speed up AI analysis
      const compressedImage = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = '/api/proxy?url=' + encodeURIComponent(imageUrl);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Optimization: 800px is enough for analysis
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
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality JPEG
        };
        img.onerror = reject;
      });

      setStatusText('GPT-5.5가 디자인 레이아웃 분석 중...');
      const startTime = performance.now();
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: compressedImage }) // Send compressed base64
      });
      const analyzeData = await analyzeRes.json();
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Failed to analyze image');

      setJsonlData(analyzeData.analysis);
      setStatusText(`스타일 학습 완료! (분석 시간: ${duration}초)`);

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const findBestTemplate = async (themeInput: string) => {
    if (!themeInput || templates.length === 0) return null;
    
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeInput, templates: templates.map(t => ({ id: t.id, name: t.name })) })
      });
      const data = await res.json();
      
      if (data.templateId) {
        return templates.find(t => t.id === data.templateId) || templates[0];
      }
    } catch (err) {
      console.error("Template matching failed:", err);
    }
    
    // Fallback to first template if matching fails
    return templates[0];
  };

  const handleQuickStart = async () => {
    if (!theme) {
      setStatusText('먼저 테마를 입력해주세요!');
      return;
    }

    setStatusText('AI가 최적의 템플릿을 찾는 중...');
    const bestTemplate = await findBestTemplate(theme);
    
    if (bestTemplate) {
      selectTemplate(bestTemplate);
      // Wait a bit for state update
      setTimeout(() => {
        handleGenerate();
      }, 500);
    } else {
      setStatusText('적절한 템플릿을 찾을 수 없습니다.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!jsonlData || !newTemplateName) return;
    if (!session) {
      signIn('google');
      return;
    }

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newTemplateName, 
          content: jsonlData,
          thumbnail: extractedImages[selectedImageIndex],
          isPublic: true // Default to public for now as per user request
        })
      });
      if (res.ok) {
        setStatusText(`'${newTemplateName}' 스타일이 라이브러리에 저장되었습니다!`);
        setNewTemplateName('');
        fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleGenerate = async () => {
    if (!jsonlData) return;

    setGenerating(true);
    setStatusText('학습된 스타일 기반 이미지 생성 중...');
    
    try {
      const endpoint = generationMode === 'strict' ? '/api/transform/controlnet' : '/api/transform';
      const referenceImageUrl = selectedTemplateId 
        ? templates.find(t => t.id === selectedTemplateId)?.thumbnail 
        : extractedImages[selectedImageIndex];

      const aiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonlAnalysis: jsonlData, 
          theme,
          initImageUrl: generationMode === 'strict' ? referenceImageUrl : undefined
        })
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to transform image');

      setResultImages(aiData.transformedUrls);
      setCurrentSlide(0);
      setStatusText('다중 카드뉴스 배경 생성 완료!');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const themeInputRef = useRef<HTMLTextAreaElement>(null);

  const selectTemplate = (template: Template) => {
    setJsonlData(template.content);
    setSelectedTemplateId(template.id);
    setStatusText(`'${template.name}' 스타일이 선택되었습니다. 주제를 입력하세요.`);
    setActiveTab('generate');
    
    // Smooth scroll and focus after tab transition
    setTimeout(() => {
      themeInputRef.current?.focus();
      themeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };



  const [currentStep, setCurrentStep] = useState(0); // 0: Library, 1: Learning, 2: Config, 3: Editor

  // Sync tab switching with wizard steps
  useEffect(() => {
    if (activeTab === 'library') setCurrentStep(0);
    if (activeTab === 'generate') setCurrentStep(2);
  }, [activeTab]);

  const goToStep = (step: number) => {
    setCurrentStep(step);
    if (step === 0) setActiveTab('library');
    if (step === 2) setActiveTab('generate');
  };

  const handleSelectTemplateAndContinue = (template: any) => {
    selectTemplate(template);
    goToStep(2);
    setTimeout(() => {
      themeInputRef.current?.focus();
    }, 100);
  };

  const renderStepIndicator = () => (
    <div className={styles.stepper}>
      {[
        { id: 0, label: '스타일 선택' },
        { id: 1, label: '스타일 학습' },
        { id: 2, label: '내용 입력' },
        { id: 3, label: '편집 및 저장' }
      ].map((step) => (
        <div 
          key={step.id} 
          className={`${styles.stepItem} ${currentStep === step.id ? styles.activeStep : ''} ${currentStep > step.id ? styles.completedStep : ''}`}
        >
          <div className={styles.stepDot}>{currentStep > step.id ? '✓' : step.id + 1}</div>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.dashboard}>
      <div className={styles.content}>
        <header className={styles.contentHeader}>
          {renderStepIndicator()}
          <div className={styles.badge}>
            PRO 플랜 사용 중
          </div>
        </header>

        <div className={styles.scrollArea}>
          {currentStep === 0 && (
            <div className={styles.libraryView}>
              <section className={styles.hero}>
                <div className={styles.heroContent}>
                  <h1 className={styles.heroTitle}>Premium AI 카드뉴스</h1>
                  <p className={styles.heroSubtitle}>트렌드를 학습한 AI로 10초 만에 전문가급 콘텐츠를 만드세요.</p>
                  <button className="btn-primary" onClick={() => goToStep(1)}>
                    <span>🎨</span> 새로운 스타일 학습하기
                  </button>
                </div>
                <div className={styles.heroStats}>
                   <div className={styles.statItem}>
                      <span className={styles.statValue}>1,200+</span>
                      <span className={styles.statLabel}>생성 완료</span>
                   </div>
                </div>
              </section>

              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>추천 템플릿 라이브러리</h2>
                <p className={styles.sectionDesc}>마음에 드는 스타일을 선택하여 바로 제작을 시작하세요.</p>
              </div>

              {templates.length === 0 ? (
                <div className={styles.templateGrid}>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={`${styles.skeleton}`} style={{ height: '280px', borderRadius: 'var(--radius-lg)' }}></div>
                  ))}
                </div>
              ) : (
                <div className={styles.templateGrid}>
                  {templates.map(template => (
                    <TemplateCard 
                      key={template.id}
                      name={template.name}
                      thumbnail={template.thumbnail}
                      creatorName={template.user?.name}
                      creatorImage={template.user?.image}
                      isSelected={selectedTemplateId === template.id}
                      onClick={() => handleSelectTemplateAndContinue(template)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.learningView}>
              <div className={`glass-panel ${styles.wizardCard}`}>
                <h2 className={styles.sectionTitle}>인스타그램 스타일 학습</h2>
                <p className={styles.sectionDesc}>분석하고 싶은 포스트 URL을 입력하세요. AI가 디자인 에스테틱을 추출합니다.</p>
                <form onSubmit={handleFetchImages} className={styles.searchForm}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="https://www.instagram.com/p/..." 
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                  />
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? <div className="loader"></div> : '이미지 분석'}
                  </button>
                </form>

                <div className={styles.quickTests}>
                  <p className={styles.quickTestLabel}>업종별 빠른 테스트:</p>
                  <div className={styles.chipGroup}>
                    {industryExamples.map((ex) => (
                      <button 
                        key={ex.name} 
                        className={styles.chip}
                        onClick={() => {
                          setInstagramUrl(ex.url);
                          handleFetchImages(ex.url); // Instant fetch for WOW experience
                        }}
                      >
                        {ex.name}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className={styles.extractionResults}>
                    <div className={styles.imageGridSmall}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={styles.skeleton} style={{ aspectRatio: '1', borderRadius: 'var(--radius-md)' }}></div>
                      ))}
                    </div>
                  </div>
                ) : extractedImages.length > 0 && (
                  <div className={styles.extractionResults}>
                    <h3 className={styles.label}>학습할 이미지 선택</h3>
                    <div className={styles.imageGridSmall}>
                      {extractedImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          className={`${styles.gridItemSmall} ${selectedImageIndex === idx ? styles.selectedItem : ''}`}
                          onClick={() => setSelectedImageIndex(idx)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt={`Extracted ${idx}`} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                       <button className="btn-secondary" onClick={() => goToStep(0)}>뒤로가기</button>
                       <button className="btn-primary" style={{ flex: 1 }} onClick={handleAnalyze} disabled={analyzing}>
                          {analyzing ? <div className="loader"></div> : '디자인 에스테틱 추출 시작'}
                       </button>
                    </div>
                  </div>
                )}
                
                {analyzing && (
                  <div className={styles.loadingOverlay}>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className={styles.statusGroup}>
                       <div className={styles.loader} style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
                       <h3 className={styles.statusTitle}>
                         {progress < 40 ? '이미지 레이아웃 분석 중...' : progress < 80 ? '컬러 팔레트 추출 중...' : '디자인 에스테틱 최적화 중...'}
                       </h3>
                       <p className={styles.progressPercent}>{Math.round(progress)}%</p>
                    </div>
                    <div className={styles.tipBox}>
                      <p className={styles.tipText}>{loadingTips[currentTipIndex]}</p>
                    </div>
                  </div>
                )}
                
                {jsonlData && !analyzing && (
                  <div className={styles.successMessage}>
                    <div className={styles.checkIcon}>✨</div>
                    <h3>스타일 분석 완료!</h3>
                    <p>이제 이 디자인 스타일로 카드뉴스를 제작할 수 있습니다.</p>
                    <button className="btn-primary" onClick={() => goToStep(2)}>제작 시작하기</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.configView}>
              <div className={`glass-panel ${styles.wizardCard}`}>
                <h2 className={styles.sectionTitle}>카드뉴스 내용 입력</h2>
                <p className={styles.sectionDesc}>제작하고 싶은 주제나 핵심 내용을 입력하세요.</p>
                
                <div className={styles.formGroup}>
                  <label className="label">적용된 스타일</label>
                  <div className={styles.selectedStyle}>
                    {selectedTemplateId ? (
                      <span className={`${styles.styleBadge} ${styles.templateBadge}`}>
                        🏛️ {templates.find(t => t.id === selectedTemplateId)?.name || '기본 템플릿'}
                      </span>
                    ) : jsonlData ? (
                      <span className={`${styles.styleBadge} ${styles.customBadge}`}>
                        ✨ 커스텀 디자인 DNA (학습됨)
                      </span>
                    ) : (
                      <span className={`${styles.styleBadge} ${styles.noneBadge}`}>
                        ⚠️ 선택된 스타일 없음
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className="label">뉴스 주제 / 내용</label>
                  <textarea 
                    ref={themeInputRef}
                    className="input-field" 
                    rows={6} 
                    placeholder="예: '2026 테크 트렌드 톱3' 또는 '아이폰 출시 소식'"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="label">AI 모델 최적화</label>
                  <div className={styles.modelToggle}>
                    <button 
                      className={`${styles.toggleBtn} ${generationMode === 'creative' ? styles.active : ''}`}
                      onClick={() => setGenerationMode('creative')}
                    >
                      Premium (GPT Image-2)
                    </button>
                    <button 
                      className={`${styles.toggleBtn} ${generationMode === 'strict' ? styles.active : ''}`}
                      onClick={() => setGenerationMode('strict')}
                    >
                      Strict (Design DNA)
                    </button>
                  </div>
                </div>

                <div className={styles.actionGroup}>
                  <button className="btn-secondary" onClick={() => goToStep(0)}>← 스타일 변경</button>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1 }} 
                    onClick={async () => {
                      await handleGenerate();
                      goToStep(3);
                    }} 
                    disabled={generating || (!jsonlData && !selectedTemplateId)}
                  >
                    {generating ? <div className="loader"></div> : 'AI 카드뉴스 생성하기'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.editorView}>
              <div className={styles.editorHeader}>
                <div className={styles.editorInfo}>
                  <h2 className={styles.sectionTitle}>최종 편집 및 다운로드</h2>
                  <p className={styles.sectionDesc}>텍스트를 더블클릭하여 내용을 수정하고, 완성된 이미지를 저장하세요.</p>
                </div>
                <div className={styles.slideActions}>
                  {resultImages.length > 0 && (
                    <div className={styles.pagination}>
                      {resultImages.map((_, idx) => (
                        <button 
                          key={idx}
                          className={`${styles.pageBtn} ${currentSlide === idx ? styles.activePage : ''}`}
                          onClick={() => setCurrentSlide(idx)}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn-secondary" onClick={() => goToStep(2)}>새로 만들기</button>
                </div>
              </div>

              <div className={styles.editorLayout}>
                <div className={styles.canvasContainer}>
                  {generating ? (
                    <div className={styles.loadingOverlay}>
                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className={styles.statusGroup}>
                        <div className={styles.pulseIcon}>🎨</div>
                        <h3 className={styles.statusTitle}>
                          {progress < 30 ? '브랜드 스타일 입히는 중...' : progress < 60 ? 'AI 카드뉴스 배경 생성 중...' : progress < 90 ? '고해상도 픽셀 렌더링 중...' : '최종 결과물 완성하는 중...'}
                        </h3>
                        <p className={styles.progressPercent}>{Math.round(progress)}%</p>
                      </div>
                      <div className={styles.tipBox}>
                        <p className={styles.tipText}>{loadingTips[currentTipIndex]}</p>
                      </div>
                    </div>
                  ) : resultImages.length > 0 ? (
                    <CanvasEditor 
                      key={currentSlide}
                      imageUrl={resultImages[currentSlide]} 
                      onDownloadComplete={() => setStatusText(`${currentSlide + 1}번 슬라이드 저장 완료!`)} 
                    />
                  ) : (
                    <div className={styles.loadingPlaceholder}>
                      <div className={styles.pulseIcon}>🎨</div>
                      <p>AI가 이미지를 생성하고 있습니다...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {statusText && (
        <div className={styles.toast}>
          {statusText}
        </div>
      )}
    </div>
  );
}
