'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import styles from './CanvasEditor.module.css';

interface CanvasEditorProps {
  imageUrl: string;
  onDownloadComplete?: () => void;
}

export default function CanvasEditor({ imageUrl, onDownloadComplete }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);

  // Settings state
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [activeStrokeColor, setActiveStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.1);
  const [opacity, setOpacity] = useState(1);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('bold');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [fontFamily, setFontFamily] = useState('Pretendard, sans-serif');

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric Canvas with responsive sizing
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 800,
      backgroundColor: '#f1f5f9',
      preserveObjectStacking: true
    });

    // Figma-style Controls Theme
    fabric.InteractiveObject.prototype.transparentCorners = false;
    fabric.InteractiveObject.prototype.cornerColor = '#6366f1';
    fabric.InteractiveObject.prototype.cornerStyle = 'circle';
    fabric.InteractiveObject.prototype.cornerSize = 10;
    fabric.InteractiveObject.prototype.borderColor = '#6366f1';
    fabric.InteractiveObject.prototype.borderScaleFactor = 1.5;

    setCanvasInstance(canvas);

    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeObject = canvas.getActiveObject();
      
      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject && !(activeObject as any).isEditing) {
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveHistory();
      }

      // Copy/Paste (Simple implementation)
      if (e.ctrlKey && e.key === 'c' && activeObject) {
        activeObject.clone().then((cloned: any) => {
          (window as any)._clipboard = cloned;
        });
      }

      if (e.ctrlKey && e.key === 'v' && (window as any)._clipboard) {
        (window as any)._clipboard.clone().then((clonedObj: any) => {
          canvas.discardActiveObject();
          clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
          });
          if (clonedObj.type === 'activeSelection') {
            clonedObj.canvas = canvas;
            clonedObj.forEachObject((obj: any) => {
              canvas.add(obj);
            });
            clonedObj.setCoords();
          } else {
            canvas.add(clonedObj);
          }
          canvas.setActiveObject(clonedObj);
          canvas.requestRenderAll();
          saveHistory();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Load Background Image
    const imgElement = new Image();
    imgElement.crossOrigin = "anonymous";
    imgElement.src = `/api/proxy?url=${encodeURIComponent(imageUrl)}`;
    imgElement.onload = () => {
      canvas.setDimensions({ width: imgElement.width, height: imgElement.height });
      const fabricImg = new fabric.FabricImage(imgElement, {
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });
      canvas.backgroundImage = fabricImg;
      canvas.requestRenderAll();
      saveHistory();
    };

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
      setCanvasInstance(null);
    };
  }, [imageUrl]);

  const saveHistory = () => {
    if (!canvasInstance) return;
    const json = JSON.stringify(canvasInstance.toJSON());
    setHistory(prev => [...prev.slice(0, historyIndex + 1), json]);
    setHistoryIndex(prev => prev + 1);
  };

  // Sync state with active selection
  useEffect(() => {
    if (!canvasInstance) return;

    const onSelection = () => {
      const activeObject = canvasInstance.getActiveObject() as fabric.Textbox;
      if (activeObject && activeObject.type === 'textbox') {
        setActiveColor((activeObject.fill as string) || '#ffffff');
        setFontWeight((activeObject.fontWeight as 'normal' | 'bold') || 'bold');
        setTextAlign((activeObject.textAlign as 'left' | 'center' | 'right') || 'center');
      }
    };

    canvasInstance.on('selection:created', onSelection);
    canvasInstance.on('selection:updated', onSelection);

    return () => {
      canvasInstance.off('selection:created', onSelection);
      canvasInstance.off('selection:updated', onSelection);
    };
  }, [canvasInstance]);

  const addText = () => {
    if (!canvasInstance) return;

    const text = new fabric.Textbox('새로운 텍스트 입력', {
      left: canvasInstance.width! / 2,
      top: canvasInstance.height! / 2,
      originX: 'center',
      originY: 'center',
      width: canvasInstance.width! * 0.8,
      fontSize: 60,
      fill: activeColor,
      fontWeight: fontWeight,
      textAlign: textAlign,
      fontFamily: fontFamily,
      charSpacing: letterSpacing,
      lineHeight: lineHeight,
      opacity: opacity,
      stroke: strokeWidth > 0 ? activeStrokeColor : undefined,
      strokeWidth: strokeWidth,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.4)',
        blur: 10,
        offsetX: 2,
        offsetY: 2
      }),
    });

    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
    canvasInstance.requestRenderAll();
    saveHistory();
  };

  const deleteSelected = () => {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();
    if (activeObject) {
      canvasInstance.remove(activeObject);
      canvasInstance.discardActiveObject();
      canvasInstance.requestRenderAll();
    }
  };

  const updateActiveText = (prop: string, value: any) => {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject() as fabric.Textbox;
    if (activeObject && activeObject.type === 'textbox') {
      activeObject.set(prop as any, value);
      canvasInstance.requestRenderAll();
    }
  };

  const undo = () => {
    if (historyIndex > 0 && canvasInstance) {
      const prev = history[historyIndex - 1];
      canvasInstance.loadFromJSON(JSON.parse(prev)).then(() => {
        canvasInstance.requestRenderAll();
        setHistoryIndex(prevIdx => prevIdx - 1);
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1 && canvasInstance) {
      const next = history[historyIndex + 1];
      canvasInstance.loadFromJSON(JSON.parse(next)).then(() => {
        canvasInstance.requestRenderAll();
        setHistoryIndex(prevIdx => prevIdx + 1);
      });
    }
  };

  const handleDownload = () => {
    if (!canvasInstance) return;
    canvasInstance.discardActiveObject();
    canvasInstance.requestRenderAll();

    setTimeout(() => {
      const dataURL = canvasInstance.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `carnews_${Date.now()}.png`;
      link.click();
      onDownloadComplete?.();
    }, 100);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button onClick={undo} className={styles.btnIcon} disabled={historyIndex <= 0}>↩️</button>
          <button onClick={redo} className={styles.btnIcon} disabled={historyIndex >= history.length - 1}>↪️</button>
        </div>

        <div className={styles.toolGroup}>
          <button onClick={addText} className={styles.btnAction}>
            <span>+</span> 텍스트
          </button>
        </div>

        <div className={styles.toolGroup}>
          <select 
            className={styles.select}
            value={fontFamily}
            onChange={(e) => {
              setFontFamily(e.target.value);
              updateActiveText('fontFamily', e.target.value);
            }}
          >
            <option value="Pretendard, sans-serif">Pretendard</option>
            <option value="'GmarketSansMedium', sans-serif">Gmarket Sans</option>
            <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
            <option value="'Nanum Square', sans-serif">Nanum Square</option>
          </select>
        </div>

        <div className={styles.toolGroup}>
          <input
            type="color"
            className={styles.colorPicker}
            value={activeColor}
            onChange={(e) => {
              setActiveColor(e.target.value);
              updateActiveText('fill', e.target.value);
            }}
          />
        </div>

        <div className={styles.toolGroup}>
          <button 
            className={`${styles.toggleBtn} ${fontWeight === 'bold' ? styles.toggleBtnActive : ''}`}
            onClick={() => {
              const next = fontWeight === 'bold' ? 'normal' : 'bold';
              setFontWeight(next);
              updateActiveText('fontWeight', next);
            }}
          >
            B
          </button>
        </div>

        <div className={styles.toolGroup}>
          <button 
            className={`${styles.toggleBtn} ${textAlign === 'left' ? styles.toggleBtnActive : ''}`}
            onClick={() => { setTextAlign('left'); updateActiveText('textAlign', 'left'); }}
          >
            L
          </button>
          <button 
            className={`${styles.toggleBtn} ${textAlign === 'center' ? styles.toggleBtnActive : ''}`}
            onClick={() => { setTextAlign('center'); updateActiveText('textAlign', 'center'); }}
          >
            C
          </button>
          <button 
            className={`${styles.toggleBtn} ${textAlign === 'right' ? styles.toggleBtnActive : ''}`}
            onClick={() => { setTextAlign('right'); updateActiveText('textAlign', 'right'); }}
          >
            R
          </button>
        </div>

        <div className={styles.toolGroup}>
          <label className={styles.toolLabel}>자간</label>
          <input 
            type="range" min="-100" max="500" step="10" 
            className={styles.rangeInput}
            value={letterSpacing}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setLetterSpacing(val);
              updateActiveText('charSpacing', val);
            }}
          />
        </div>

        <div className={styles.toolGroup}>
          <label className={styles.toolLabel}>투명도</label>
          <input 
            type="range" min="0" max="1" step="0.1" 
            className={styles.rangeInput}
            value={opacity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setOpacity(val);
              updateActiveText('opacity', val);
            }}
          />
        </div>

        <button onClick={deleteSelected} className={styles.btnDelete}>
          삭제
        </button>

        <button onClick={handleDownload} className={styles.btnDownload}>
          저장
        </button>
      </div>

      <div className={styles.canvasWrapper}>
        <div className={styles.canvasShadow}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <p className={styles.hint}>
        💡 텍스트를 더블클릭하여 내용을 수정하고, 드래그하여 위치와 크기를 조절하세요.
      </p>
    </div>
  );
}
