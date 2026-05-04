'use client';

import React, { useState } from 'react';
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

  const handleFetchImages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUrl) return;

    setLoading(true);
    setStatusText('인스타그램에서 이미지를 추출하는 중...');
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
    setStatusText('AI로 이미지를 변환하는 중...');
    
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
      setStatusText('카드 뉴스 생성 완료!');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
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
                  <img src={img} alt={`Extracted ${index + 1}`} />
                  <button 
                    className={styles.downloadSmallBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(img, index);
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
                {generating ? <span className={styles.loader}></span> : '선택한 이미지로 AI 카드뉴스 생성'}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultImage} alt="Generated Card News" className={styles.generatedImage} />
              <button 
                onClick={() => downloadImage(resultImage, 999)} 
                className={`btn-primary ${styles.downloadBtn}`}
              >
                카드 뉴스 다운로드
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
