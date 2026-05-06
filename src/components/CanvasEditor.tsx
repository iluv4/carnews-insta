'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import styles from './CanvasEditor.module.css';
import type { CanvasLayer, EditableJSON } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DISPLAY_WIDTH = 500;        // px — rendered canvas width
const LOGICAL_WIDTH = 1080;       // px — editableJson coordinate space

// ── Props ─────────────────────────────────────────────────────────────────────

interface CanvasEditorProps {
  /** Background image URL (still required; used as canvas bg when no editableJson) */
  imageUrl: string;
  /** If provided, will load editableJson from GET /api/projects/:projectId/slides/:slideId */
  projectId?: string;
  /** Required together with projectId to enable load/save */
  slideId?: string;
  /** Pre-loaded editableJson — overrides fetch when supplied directly */
  initialEditableJson?: EditableJSON;
  /** Called after a successful save to the API */
  onSave?: (editableJson: EditableJSON) => void;
  onDownloadComplete?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute display canvas height keeping aspect ratio of the logical canvas */
function computeDisplayHeight(editableJson?: EditableJSON | null): number {
  if (editableJson?.canvas) {
    const { width, height } = editableJson.canvas;
    return Math.round(DISPLAY_WIDTH * (height / width));
  }
  return 875; // legacy default
}

/** Scale factor: logical → display */
function getScale(editableJson?: EditableJSON | null): number {
  const logicalWidth = editableJson?.canvas.width ?? LOGICAL_WIDTH;
  return DISPLAY_WIDTH / logicalWidth;
}

// ── Serialise fabric canvas → EditableJSON layers ────────────────────────────

function serializeLayers(canvas: fabric.Canvas, scale: number): CanvasLayer[] {
  const layers: CanvasLayer[] = [];
  canvas.getObjects().forEach((obj, idx) => {
    const id = (obj as any).__layerId || 'layer_' + idx;
    const x = Math.round((obj.left ?? 0) / scale);
    const y = Math.round((obj.top ?? 0) / scale);
    const w = Math.round(((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale);
    const h = Math.round(((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale);

    if (obj instanceof fabric.IText || obj instanceof fabric.Textbox) {
      layers.push({
        id,
        type: 'text',
        text: obj.text ?? '',
        x, y, w, h,
        fontFamily: obj.fontFamily,
        fontSize: obj.fontSize ? Math.round(obj.fontSize / scale) : undefined,
        fontWeight: typeof obj.fontWeight === 'number' ? obj.fontWeight : undefined,
        color: obj.fill as string | undefined,
        lineHeight: obj.lineHeight,
        align: obj.textAlign as string | undefined,
        locked: !obj.selectable,
      });
    } else if (obj instanceof fabric.FabricImage) {
      layers.push({
        id,
        type: 'image',
        src: (obj as any).getSrc?.() ?? '',
        x, y, w, h,
        locked: !obj.selectable,
        opacity: obj.opacity !== 1 ? obj.opacity : undefined,
      });
    } else if (obj instanceof fabric.Rect || obj instanceof fabric.Circle || obj instanceof fabric.Ellipse) {
      layers.push({
        id,
        type: 'shape',
        shape: obj instanceof fabric.Rect ? 'rect' : obj instanceof fabric.Circle ? 'circle' : 'ellipse',
        x, y, w, h,
        fill: obj.fill as string | undefined,
        stroke: obj.stroke as string | undefined,
        radius: obj instanceof fabric.Rect ? (obj.rx ?? 0) : undefined,
      });
    }
  });
  return layers;
}

// ── Load editableJson layers → fabric objects ─────────────────────────────────

async function loadLayers(
  canvas: fabric.Canvas,
  layers: CanvasLayer[],
  scale: number
): Promise<void> {
  for (const layer of layers) {
    if (layer.id === 'bg') continue; // background handled separately

    const x = layer.x * scale;
    const y = layer.y * scale;
    const w = layer.w * scale;
    const h = layer.h * scale;

    if (layer.type === 'text') {
      const textObj = new fabric.IText(layer.text, {
        left: x,
        top: y,
        width: w,
        fontFamily: layer.fontFamily ?? 'Pretendard, sans-serif',
        fontSize: layer.fontSize ? layer.fontSize * scale : 32 * scale,
        fontWeight: layer.fontWeight ?? 400,
        fill: layer.color ?? '#ffffff',
        textAlign: (layer.align ?? 'left') as any,
        lineHeight: layer.lineHeight ?? 1.2,
        selectable: !layer.locked,
      });
      (textObj as any).__layerId = layer.id;
      canvas.add(textObj);
    } else if (layer.type === 'image') {
      try {
        const img = await fabric.FabricImage.fromURL(layer.src, { crossOrigin: 'anonymous' });
        img.set({ left: x, top: y, selectable: !layer.locked });
        img.scaleToWidth(w);
        (img as any).__layerId = layer.id;
        canvas.add(img);
      } catch {
        // skip broken image layers silently
      }
    } else if (layer.type === 'shape') {
      let shape: fabric.FabricObject;
      if (layer.shape === 'circle') {
        shape = new fabric.Circle({ radius: w / 2, fill: layer.fill ?? '#cccccc', stroke: layer.stroke });
      } else {
        shape = new fabric.Rect({ width: w, height: h, fill: layer.fill ?? '#cccccc', stroke: layer.stroke, rx: layer.radius, ry: layer.radius });
      }
      shape.set({ left: x, top: y, selectable: !(layer as any).locked });
      (shape as any).__layerId = layer.id;
      canvas.add(shape);
    }
  }
  canvas.renderAll();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CanvasEditor({
  imageUrl,
  projectId,
  slideId,
  initialEditableJson,
  onSave,
  onDownloadComplete,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);
  const [editableJson, setEditableJson] = useState<EditableJSON | null>(initialEditableJson ?? null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // ── Fetch editableJson from API if projectId/slideId provided ────────────────
  useEffect(() => {
    if (!projectId || !slideId || initialEditableJson) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/projects/' + projectId + '/slides/' + slideId)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.editableJson) {
          setEditableJson(data.editableJson as EditableJSON);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, slideId, initialEditableJson]);

  // ── Initialise fabric canvas ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const displayHeight = computeDisplayHeight(editableJson);
    const scale = getScale(editableJson);

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: DISPLAY_WIDTH,
      height: displayHeight,
      backgroundColor: '#f8fafc',
    });

    // Determine background image URL
    const bgSrc = editableJson?.layers.find((l) => l.id === 'bg' && l.type === 'image')
      ? (editableJson.layers.find((l) => l.id === 'bg' && l.type === 'image') as any).src
      : imageUrl;

    const bgPromise = fabric.FabricImage.fromURL(bgSrc || imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
      img.scaleToWidth(DISPLAY_WIDTH);
      canvas.backgroundImage = img;
      canvas.renderAll();
    }).catch(() => {});

    // Load non-bg layers
    if (editableJson?.layers) {
      const nonBg = editableJson.layers.filter((l) => l.id !== 'bg');
      bgPromise.then(() => loadLayers(canvas, nonBg, scale));
    } else {
      // Legacy: just add a default title text
      bgPromise.then(() => {
        const title = new fabric.IText('여기에 제목 입력', {
          left: 50,
          top: 100,
          fontSize: 40,
          fontFamily: 'Pretendard',
          fontWeight: 900,
          fill: '#ffffff',
        });
        canvas.add(title);
        canvas.renderAll();
      });
    }

    setCanvasInstance(canvas);

    return () => {
      canvas.dispose();
      setCanvasInstance(null);
    };
    // Re-init whenever editableJson or imageUrl changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableJson, imageUrl]);

  // ── Toolbar actions ───────────────────────────────────────────────────────────

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
      const dataURL = canvasInstance.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'cardnews_' + Date.now() + '.png';
      link.click();
      onDownloadComplete?.();
    }, 100);
  };

  // ── Save to API ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!canvasInstance || !projectId || !slideId) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const scale = getScale(editableJson);
      const layers = serializeLayers(canvasInstance, scale);

      // Prepend bg layer from existing editableJson so it isn't lost
      const bgLayer = editableJson?.layers.find((l) => l.id === 'bg');
      const allLayers: CanvasLayer[] = bgLayer ? [bgLayer, ...layers] : layers;

      const newEditableJson: EditableJSON = {
        canvas: editableJson?.canvas ?? { width: LOGICAL_WIDTH, height: 1350 },
        layers: allLayers,
      };

      const res = await fetch('/api/projects/' + projectId + '/slides/' + slideId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editableJson: newEditableJson }),
      });

      if (!res.ok) throw new Error('save failed');
      setSaveStatus('saved');
      onSave?.(newEditableJson);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [canvasInstance, projectId, slideId, editableJson, onSave]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const canSave = Boolean(projectId && slideId);

  return (
    <div className={styles.editorContainer}>
      {loading && (
        <div className={styles.loadingBanner}>슬라이드 레이어 불러오는 중…</div>
      )}

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
          {canSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={
                styles.saveBtn +
                (saveStatus === 'saved' ? ' ' + styles.saveBtnSaved : '') +
                (saveStatus === 'error' ? ' ' + styles.saveBtnError : '')
              }
            >
              {saving ? '저장 중…' : saveStatus === 'saved' ? '✓ 저장됨' : saveStatus === 'error' ? '저장 실패' : '💾 저장'}
            </button>
          )}
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
