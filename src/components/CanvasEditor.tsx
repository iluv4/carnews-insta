'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import styles from './CanvasEditor.module.css';

interface CanvasEditorProps {
  imageUrl: string;
  onDownloadComplete?: () => void;
}

export default function CanvasEditor({ imageUrl, onDownloadComplete }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 500,
      height: 875,
      backgroundColor: '#f8fafc',
    });

    fabric.Image.fromURL(imageUrl, {
      crossOrigin: 'anonymous'
    }).then((img) => {
      img.scaleToWidth(500);
      canvas.backgroundImage = img;
      
      const title = new fabric.IText('여기에 제목 입력', {
        left: 50,
        top: 100,
        fontSize: 40,
        fontFamily: 'Pretendard',
        fontWeight: '900',
        fill: '#ffffff',
      });
      canvas.add(title);
      canvas.renderAll();
    });

    setCanvasInstance(canvas);

    return () => {
      canvas.dispose();
    };
  }, [imageUrl]);

  const addText = () => {
    if (!canvasInstance) return;
    const text = new fabric.IText('새로운 텍스트', {
      left: 100,
      top: 100,
      fontSize: 30,
      fill: '#333',
    });
    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
  };

  const deleteSelected = () => {
    if (!canvasInstance) return;
    const activeObjects = canvasInstance.getActiveObjects();
    canvasInstance.remove(...activeObjects);
    canvasInstance.discardActiveObject();
  };

  const handleDownload = () => {
    if (!canvasInstance) return;
    canvasInstance.discardActiveObject();
    canvasInstance.requestRenderAll();
    setTimeout(() => {
      const dataURL = canvasInstance.toDataURL({ format: 'png', quality: 1 });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `cardnews_${Date.now()}.png`;
      link.click();
      onDownloadComplete?.();
    }, 100);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button onClick={addText} className={styles.toolBtn}>
            <span className={styles.toolIcon}>T</span>
            <span>텍스트 추가</span>
          </button>
          <button onClick={deleteSelected} className={styles.toolBtn}>
            <span className={styles.toolIcon}>🗑️</span>
            <span>삭제</span>
          </button>
        </div>

        <div className={styles.actionGroup}>
          <button onClick={handleDownload} className={styles.downloadBtn}>
            ✨ 고화질 저장하기
          </button>
        </div>
      </div>

      <div className={styles.canvasWrapper}>
        <div className={styles.canvasShadow}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <p className={styles.hint}>
        💡 텍스트를 더블클릭하여 수정하고, 드래그하여 위치를 조절하세요.
      </p>
    </div>
  );
}
