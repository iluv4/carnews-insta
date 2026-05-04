'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CardGenerator.module.css';
import TemplateCard from './TemplateCard';
import { useSession, signIn } from 'next-auth/react';

interface Template {
  id: string;
  name: string;
  content: string;
  thumbnail?: string;
  user?: { name: string; image: string };
}

export default function CardGenerator() {
  const { data: session } = useSession();
  
  // UI States
  const [activeTab, setActiveTab] = useState<'library' | 'generate'>('library');
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Data States
  const [instagramUrl, setInstagramUrl] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [jsonlData, setJsonlData] = useState('');
  const [resultImage, setResultImage] = useState('');
  
  // Template Library
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Generation Settings
  const [theme, setTheme] = useState('');
  const [overlayText, setOverlayText] = useState('');
  const [overlayColor, setOverlayColor] = useState('#ffffff');
  
  const imgRef = useRef<HTMLImageElement>(null);

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

  const handleFetchImages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUrl) return;

    setLoading(true);
    setStatusText('인스타그램 미디어 추출 중...');
    setExtractedImages([]);
    setResultImage('');
    
    try {
      const igRes = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl })
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
    setStatusText('GPT-5.5가 디자인 레이아웃 분석 중...');
    
    try {
      const imageUrl = extractedImages[selectedImageIndex];
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Failed to analyze image');

      setJsonlData(analyzeData.analysis);
      setStatusText('스타일 학습 완료! 템플릿으로 저장하거나 바로 생성하세요.');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setAnalyzing(false);
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
      const aiRes = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonlAnalysis: jsonlData, theme })
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to transform image');

      setResultImage(aiData.transformedUrl);
      setStatusText('카드뉴스 배경 생성 완료!');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const selectTemplate = (template: Template) => {
    setJsonlData(template.content);
    setSelectedTemplateId(template.id);
    setStatusText(`'${template.name}' 스타일이 로드되었습니다.`);
    setActiveTab('generate');
  };

  const downloadWithText = async () => {
    if (!resultImage || !imgRef.current) return;
    try {
      setStatusText('이미지 합성 중...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = '/api/proxy?url=' + encodeURIComponent(resultImage);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (overlayText) {
        const fontSize = Math.floor(canvas.width * 0.08); 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = overlayColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        const lines = overlayText.split('\n');
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        let startY = (canvas.height - totalHeight) / 2 + (lineHeight / 2);
        lines.forEach(line => {
          ctx.fillText(line, canvas.width / 2, startY);
          startY += lineHeight;
        });
      }
      const blobUrl = canvas.toDataURL('image/png');
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `cardnews_generated.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatusText('다운로드 완료!');
    } catch (err) {
      console.error("Composite download failed:", err);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Sidebar - Template Library */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Template Library</h3>
          <p>학습된 프리미엄 스타일</p>
        </div>
        <div className={styles.templateGrid}>
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              name={template.name}
              thumbnail={template.thumbnail}
              creatorName={template.user?.name}
              creatorImage={template.user?.image}
              onClick={() => selectTemplate(template)}
              isSelected={selectedTemplateId === template.id}
            />
          ))}
          {templates.length === 0 && (
            <div className={styles.emptyState}>
              등록된 템플릿이 없습니다.
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.content}>
        <header className={styles.contentHeader}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'library' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('library')}
            >
              레퍼런스 학습
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'generate' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('generate')}
            >
              카드뉴스 생성
            </button>
          </div>
          {statusText && <div className={styles.badge}>{statusText}</div>}
        </header>

        <div className={styles.scrollArea}>
          {activeTab === 'library' ? (
            <div className={styles.libraryView}>
              <section className={`glass-panel ${styles.section}`}>
                <h2 className={styles.sectionTitle}>1. 인스타그램 레퍼런스 분석</h2>
                <p className={styles.sectionDesc}>분석할 인스타그램 URL을 입력하세요. GPT-5.5가 디자인 스타일을 학습합니다.</p>
                <form onSubmit={handleFetchImages} className={styles.searchForm}>
                  <input 
                    type="url" 
                    className="input-field" 
                    placeholder="https://www.instagram.com/p/..." 
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? <span className={styles.loader}></span> : '이미지 추출'}
                  </button>
                </form>

                {extractedImages.length > 0 && (
                  <div className={styles.extractionResults}>
                    <div className={styles.imageGridSmall}>
                      {extractedImages.map((img, index) => (
                        <div 
                          key={index} 
                          className={`${styles.gridItemSmall} ${selectedImageIndex === index ? styles.selectedItem : ''}`}
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/proxy?url=${encodeURIComponent(img)}`} alt={`Ref ${index}`} />
                        </div>
                      ))}
                    </div>
                    <button className={`btn-primary ${styles.actionBtn}`} onClick={handleAnalyze} disabled={analyzing}>
                      {analyzing ? <span className={styles.loader}></span> : '이 스타일 학습하기 (Analyze)'}
                    </button>
                  </div>
                )}
              </section>

              {jsonlData && (
                <section className={`glass-panel ${styles.section}`}>
                  <h2 className={styles.sectionTitle}>2. 라이브러리에 저장</h2>
                  <p className={styles.sectionDesc}>학습된 디자인 데이터를 영구 템플릿으로 저장합니다.</p>
                  <div className={styles.saveBox}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="스타일 이름 (예: 테크_모던_블루)" 
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                    />
                    <button className="btn-primary" onClick={handleSaveTemplate} disabled={!newTemplateName}>
                      저장하기
                    </button>
                  </div>
                  <details className={styles.details}>
                    <summary>추출된 디자인 데이터 확인 (JSONL)</summary>
                    <pre className={styles.jsonlView}>{jsonlData}</pre>
                  </details>
                </section>
              )}
            </div>
          ) : (
            <div className={styles.generateView}>
              <div className={styles.generateGrid}>
                {/* Generation Form */}
                <section className={`glass-panel ${styles.genForm}`}>
                  <h2 className={styles.sectionTitle}>디자인 설정</h2>
                  <div className={styles.formGroup}>
                    <label className="label">뉴스 테마 / 주제</label>
                    <textarea 
                      className="input-field" 
                      placeholder="예: 최신 아이폰 출시 소식, 유럽 여행 꿀팁..." 
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className="label">현재 로드된 스타일</label>
                    <div className={styles.styleBadge}>{selectedTemplateId ? '커스텀 템플릿 적용됨' : '직접 학습된 스타일 적용됨'}</div>
                  </div>
                  <button className={`btn-primary ${styles.bigBtn}`} onClick={handleGenerate} disabled={generating || !jsonlData}>
                    {generating ? <span className={styles.loader}></span> : 'AI 카드뉴스 생성하기'}
                  </button>

                  {resultImage && (
                    <div className={styles.overlayEditor}>
                      <h3 className={styles.subTitle}>텍스트 오버레이</h3>
                      <textarea 
                        className="input-field" 
                        placeholder="카드뉴스에 들어갈 텍스트..." 
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        rows={3}
                      />
                      <div className={styles.colorRow}>
                        <label className="label">텍스트 색상</label>
                        <input type="color" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className={styles.colorPicker} />
                      </div>
                      <button onClick={downloadWithText} className={`btn-primary ${styles.actionBtn}`}>이미지 합성 및 저장</button>
                    </div>
                  )}
                </section>

                {/* Preview Area */}
                <section className={`glass-panel ${styles.previewArea}`}>
                  <h2 className={styles.sectionTitle}>미리보기</h2>
                  <div className={styles.canvasContainer}>
                    {resultImage ? (
                      <div className={styles.previewWrapper}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img ref={imgRef} src={`/api/proxy?url=${encodeURIComponent(resultImage)}`} alt="Generated" className={styles.finalImage} crossOrigin="anonymous" />
                        {overlayText && (
                          <div className={styles.textOverlay} style={{ color: overlayColor }}>
                            {overlayText.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={styles.previewPlaceholder}>
                        <div className={styles.pulseIcon}>🎨</div>
                        <p>생성된 결과가 여기에 표시됩니다.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
