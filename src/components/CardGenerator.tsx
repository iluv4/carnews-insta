'use client';

import React, { useState } from 'react';
import styles from './CardGenerator.module.css';

export default function CardGenerator() {
  const [instagramUrl, setInstagramUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [reference, setReference] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [resultImage, setResultImage] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramUrl) return;

    setLoading(true);
    
    try {
      // 1. Fetch Instagram Image
      setStatusText('Extracting image from Instagram...');
      const igRes = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl })
      });
      const igData = await igRes.json();
      
      if (!igRes.ok) throw new Error(igData.error || 'Failed to fetch IG image');
      
      const imageUrl = igData.imageUrl;

      // 2. Transform Image using OpenAI
      setStatusText('Transforming image with AI...');
      const aiRes = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, theme, reference })
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) throw new Error(aiData.error || 'Failed to transform image');

      setResultImage(aiData.transformedUrl);
      setStatusText('Card News Generated!');

    } catch (error: any) {
      console.error(error);
      setStatusText(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`glass-panel ${styles.panel}`}>
        <form onSubmit={handleGenerate} className={styles.form}>
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

          <div className={styles.formGroup}>
            <label className="label">Profile Theme Description</label>
            <textarea 
              className={`input-field ${styles.textarea}`} 
              placeholder="e.g., Cyberpunk style, professional corporate, cute anime..." 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className="label">Card News Reference Style</label>
            <select 
              className="input-field" 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            >
              <option value="modern">Modern Minimalist</option>
              <option value="bold">Bold & Typography Heavy</option>
              <option value="gradient">Gradient & Glow</option>
              <option value="magazine">Magazine Editorial</option>
            </select>
          </div>

          <button 
            type="submit" 
            className={`btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loader}></span>
            ) : 'Generate Card News'}
          </button>

          {statusText && (
            <p className={styles.statusText}>{statusText}</p>
          )}
        </form>
      </div>

      <div className={`glass-panel ${styles.previewPanel}`}>
        <h2 className={styles.previewTitle}>Preview Result</h2>
        <div className={styles.imageContainer}>
          {resultImage ? (
            <div className={styles.resultWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultImage} alt="Generated Card News" className={styles.generatedImage} />
              <a href={resultImage} download="card-news.png" className={`btn-primary ${styles.downloadBtn}`}>
                Download Card
              </a>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>✨</div>
              <p>Your generated card news will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
