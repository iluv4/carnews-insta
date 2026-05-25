'use client';

// Client-side editable preview of a LayerDocument. Renders layers as scaled,
// absolutely-positioned DOM so editing is instant (no server round-trip / no
// Puppeteer). The server (/api/render-layers) is only called for the final
// high-resolution export when the user saves.

import React, { useState } from 'react';
import type { LayerDocument, Layer, TextLayer } from '@/lib/layerSchema';

interface Props {
  document: LayerDocument;
  previewWidth?: number;
}

export default function LayerEditor({ document: initialDoc, previewWidth = 360 }: Props) {
  const [doc, setDoc] = useState<LayerDocument>(initialDoc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const scale = previewWidth / doc.canvas.w;
  const previewHeight = doc.canvas.h * scale;
  const sorted = [...doc.layers].sort((a, b) => a.z - b.z);

  const updateText = (id: string, content: string) => {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id && l.type === 'text' ? { ...l, content } : l)),
    }));
  };

  const toggleVisible = (id: string) => {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? { ...l, visible: l.visible === false } : l)),
    }));
  };

  const handleExport = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/render-layers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layerDocument: doc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      const a = window.document.createElement('a');
      a.href = data.url;
      a.download = `cardnews-${Date.now()}.jpg`;
      a.click();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: previewWidth,
          height: previewHeight,
          fontFamily: "'Noto Sans KR', sans-serif",
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        }}
      >
        {sorted.map((layer) => renderLayer(layer, scale, updateText))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {doc.layers
          .filter((l) => l.type === 'text')
          .map((l) => (
            <button
              key={l.id}
              onClick={() => toggleVisible(l.id)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #ccc',
                background: l.visible === false ? '#eee' : '#fff',
                opacity: l.visible === false ? 0.5 : 1,
                cursor: 'pointer',
              }}
            >
              {l.visible === false ? '🚫' : '👁'} {(l as TextLayer).content.slice(0, 8) || l.id}
            </button>
          ))}
      </div>

      <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
        💡 텍스트를 클릭해 바로 수정하고, 칩을 눌러 레이어를 켜고 끌 수 있어요.
      </p>

      <button
        onClick={handleExport}
        disabled={saving}
        style={{
          padding: '12px 28px',
          borderRadius: 10,
          border: 'none',
          background: saving ? '#999' : '#ff6b35',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? '고화질 렌더링 중…' : '✨ 고화질로 저장하기'}
      </button>
      {error && <p style={{ color: '#d33', fontSize: 13 }}>{error}</p>}
    </div>
  );
}

function renderLayer(layer: Layer, scale: number, updateText: (id: string, content: string) => void): React.ReactNode {
  if (layer.visible === false) return null;
  const z = layer.z;

  switch (layer.type) {
    case 'background': {
      const bg =
        layer.source === 'image'
          ? { backgroundImage: `url('${layer.value}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: layer.value };
      return (
        <React.Fragment key={layer.id}>
          <div style={{ position: 'absolute', inset: 0, zIndex: z, ...bg }} />
          {layer.overlayOpacity && layer.overlayOpacity > 0 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: z + 1,
                background: `linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,${layer.overlayOpacity * 0.4}) 50%, rgba(0,0,0,${layer.overlayOpacity + 0.2}) 100%)`,
              }}
            />
          ) : null}
        </React.Fragment>
      );
    }
    case 'image':
      return (
        <div
          key={layer.id}
          style={{
            position: 'absolute',
            left: layer.bbox.x * scale,
            top: layer.bbox.y * scale,
            width: layer.bbox.w * scale,
            height: layer.bbox.h * scale,
            zIndex: z,
            backgroundImage: `url('${layer.src}')`,
            backgroundSize: layer.fit ?? 'cover',
            backgroundPosition: 'center',
            borderRadius: (layer.radius ?? 0) * scale,
          }}
        />
      );
    case 'text':
      return (
        <div
          key={layer.id}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => updateText(layer.id, e.currentTarget.textContent ?? '')}
          style={{
            position: 'absolute',
            left: layer.bbox.x * scale,
            top: layer.bbox.y * scale,
            width: layer.bbox.w * scale,
            height: layer.bbox.h * scale,
            zIndex: z,
            color: layer.color,
            fontWeight: layer.fontWeight,
            fontSize: layer.fontSize * scale,
            textAlign: layer.align ?? 'left',
            lineHeight: layer.lineHeight ?? 1.15,
            letterSpacing: (layer.letterSpacing ?? -1) * scale,
            wordBreak: 'keep-all',
            textShadow: layer.shadow,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            outline: 'none',
            cursor: 'text',
          }}
        >
          {layer.content}
        </div>
      );
    case 'shape': {
      const radius = layer.shape === 'circle' ? '50%' : `${(layer.radius ?? 0) * scale}px`;
      return (
        <div
          key={layer.id}
          style={{
            position: 'absolute',
            left: layer.bbox.x * scale,
            top: layer.bbox.y * scale,
            width: layer.bbox.w * scale,
            height: layer.bbox.h * scale,
            zIndex: z,
            background: layer.fill,
            border: layer.stroke ? `${(layer.strokeWidth ?? 2) * scale}px solid ${layer.stroke}` : undefined,
            borderRadius: radius,
          }}
        />
      );
    }
    default:
      return null;
  }
}
