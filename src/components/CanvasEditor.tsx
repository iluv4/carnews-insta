'use client';

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
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('bold');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric Canvas with responsive sizing
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 800,
      backgroundColor: '#f8fafc',
      preserveObjectStacking: true
    });
    setCanvasInstance(canvas);

    // Load Background Image with proxy to avoid CORS
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
        crossOrigin: 'anonymous'
      });
      canvas.backgroundImage = fabricImg;
      canvas.requestRenderAll();
    };

    return () => {
      canvas.dispose();
      setCanvasInstance(null);
    };
  }, [imageUrl]);

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

    const text = new fabric.Textbox('여기에 내용을 입력하세요', {
      left: canvasInstance.width! / 2,
      top: canvasInstance.height! / 2,
      originX: 'center',
      originY: 'center',
      width: canvasInstance.width! * 0.8,
      fontSize: Math.floor(canvasInstance.width! * 0.07),
      fill: activeColor,
      fontWeight: fontWeight,
      textAlign: textAlign,
      fontFamily: 'Pretendard, sans-serif',
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.5)',
        blur: 15,
        offsetX: 3,
        offsetY: 3
      }),
      cornerColor: '#6366f1',
      cornerStyle: 'circle',
      cornerSize: 12,
      transparentCorners: false,
      borderColor: '#6366f1',
      borderScaleFactor: 2
    });

    canvasInstance.add(text);
    canvasInstance.setActiveObject(text);
    canvasInstance.requestRenderAll();
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
          <button onClick={addText} className={styles.btnAction}>
            <span>+</span> 텍스트 추가
          </button>
        </div>

        <div className={styles.toolGroup}>
          <label className="label" style={{ marginBottom: 0, marginRight: '8px' }}>색상</label>
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

        <button onClick={deleteSelected} className={styles.btnDelete}>
          선택 삭제
        </button>

        <button onClick={handleDownload} className={styles.btnDownload}>
          ⬇️ 이미지 저장
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
