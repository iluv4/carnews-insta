'use client';

import React, { useState, useRef } from 'react';
import styles from './CardGenerator.module.css';

export default function CardGenerator() {
  const [instagramUrl, setInstagramUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [reference, setReference] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [resultImage, setResultImage] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Text Overlay States
  const [overlayText, setOverlayText] = useState('');
  const [overlayColor, setOverlayColor] = useState('#ffffff');
  
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFetchImages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUrl) return;

    setLoading(true);
    setStatusText('인스타그램에서 이미지를 추출하는 중...');
    setExtractedImages([]);
    setResultImage('');
    setOverlayText('');
    
    try {
      const igRes = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl })
      });
      const igData = await igRes.json();
      
      if (!igRes.ok) throw new Error(igData.error || 'Failed to fetch IG images');
      
      setExtractedImages(igData.images);
      setStatusText('이미지 추출 완료!');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (extractedImages.length === 0) return;

    setGenerating(true);
    setStatusText('AI(GPT-4V)가 이미지를 분석하고 배경을 생성하는 중...');
    
    try {
      const imageUrl = extractedImages[selectedImageIndex];

      const aiRes = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, theme, reference })
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to transform image');

      setResultImage(aiData.transformedUrl);
      setStatusText('카드 뉴스 배경 생성 완료! 텍스트를 오버레이 해보세요.');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadOriginalImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch('/api/proxy?url=' + encodeURIComponent(imageUrl));
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `instagram_${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      alert("다운로드에 실패했습니다.");
    }
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
        // Draw text
        const fontSize = Math.floor(canvas.width * 0.08); // responsive font size
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = overlayColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add text shadow for readability
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
      alert("합성 이미지 다운로드에 실패했습니다. (CORS 문제일 수 있습니다)");
    }
  };

  return (
    <div className={styles.container}>
      <div className={`glass-panel ${styles.panel}`}>
        <form onSubmit={handleFetchImages} className={styles.form}>
          <div className={styles.formGroup}>
            <label className="label">Instagram Post URL</label>
            <input 
              type="url" 
              className="input-field" 
              placeholder="https://www.instagram.com/p/..." 
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className={`btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? <span className={styles.loader}></span> : '이미지 추출하기'}
          </button>
        </form>

        {statusText && (
          <p className={styles.statusText}>{statusText}</p>
        )}

        {extractedImages.length > 0 && (
          <div className={styles.extractedSection}>
            <h3 className={styles.sectionTitle}>추출된 원본 이미지 ({extractedImages.length}장)</h3>
            <div className={styles.imageGrid}>
              {extractedImages.map((img, index) => (
                <div 
                  key={index} 
                  className={`${styles.gridItem} ${selectedImageIndex === index ? styles.selectedItem : ''}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/proxy?url=${encodeURIComponent(img)}`} alt={`Extracted ${index + 1}`} />
                  <button 
                    className={styles.downloadSmallBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadOriginalImage(img, index);
                    }}
                  >
                    다운로드
                  </button>
                </div>
              ))}
            </div>
            
            <div className={styles.aiForm}>
              <div className={styles.formGroup}>
                <label className="label">AI 변환 테마 (Theme)</label>
                <textarea 
                  className={`input-field ${styles.textarea}`} 
                  placeholder="예: 사이버펑크, 모던한 기업 스타일..." 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label">레퍼런스 스타일</label>
                <select 
                  className="input-field" 
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                >
                  <option value="modern">Modern Minimalist</option>
                  <option value="bold">Bold & Typography</option>
                  <option value="gradient">Gradient & Glow</option>
                  <option value="magazine">Magazine Editorial</option>
                </select>
              </div>
              <button 
                type="button" 
                className={`btn-primary ${styles.submitBtn}`}
                disabled={generating || !theme}
                onClick={handleGenerate}
              >
                {generating ? <span className={styles.loader}></span> : '선택한 이미지로 AI 카드뉴스 생성 (GPT-4V 적용)'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`glass-panel ${styles.previewPanel}`}>
        <h2 className={styles.previewTitle}>AI 생성 결과 미리보기</h2>
        <div className={styles.imageContainer}>
          {resultImage ? (
            <div className={styles.resultWrapper}>
              <div className={styles.overlayContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={resultImage} alt="Generated Card News" className={styles.generatedImage} crossOrigin="anonymous" />
                {overlayText && (
                  <div className={styles.textOverlay} style={{ color: overlayColor }}>
                    {overlayText.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.overlayControls}>
                <div className={styles.formGroup}>
                  <label className="label">텍스트 오버레이</label>
                  <textarea 
                    className={`input-field ${styles.textareaSmall}`} 
                    placeholder="카드뉴스에 들어갈 텍스트 입력..." 
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className="label">텍스트 색상</label>
                  <input 
                    type="color" 
                    value={overlayColor}
                    onChange={(e) => setOverlayColor(e.target.value)}
                    className={styles.colorPicker}
                  />
                </div>
              </div>

              <button 
                onClick={downloadWithText} 
                className={`btn-primary ${styles.downloadBtn}`}
              >
                이미지 저장하기
              </button>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>✨</div>
              <p>AI로 변환된 카드뉴스가 여기에 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
