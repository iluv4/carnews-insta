'use client';

// Client-side editable preview of a LayerDocument. Renders layers as scaled,
// absolutely-positioned DOM so editing is instant (no server round-trip / no
// Puppeteer). Supports selecting a layer, dragging it to reposition, inline
// text editing (double-click), and font-size/color tweaks. The server
// (/api/render-layers) is only called for the final high-res export on save.

import React, { useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import type { LayerDocument, Layer, TextLayer } from '@/lib/layerSchema';

type DragState = { id: string; startX: number; startY: number; origX: number; origY: number };

// Route remote images through our same-origin proxy so the export canvas is
// not tainted by cross-origin sources (AI backgrounds, Naver photos, …).
// data: URIs and same-origin paths are left untouched.
function proxied(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return url;
  if (/^https?:\/\//i.test(url)) return `/api/proxy?url=${encodeURIComponent(url)}`;
  return url;
}

interface Props {
  document: LayerDocument;
  previewWidth?: number;
  theme?: string;
}

export default function LayerEditor({ document: initialDoc, previewWidth = 360, theme }: Props) {
  const [doc, setDoc] = useState<LayerDocument>(initialDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  const scale = previewWidth / doc.canvas.w;
  const previewHeight = doc.canvas.h * scale;
  const sorted = [...doc.layers].sort((a, b) => a.z - b.z);
  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;

  const [drag, setDrag] = useState<DragState | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const patchLayer = (id: string, partial: Partial<Layer>) => {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...partial } as Layer) : l)),
    }));
  };

  const updateText = (id: string, content: string) => patchLayer(id, { content } as Partial<TextLayer>);
  const toggleVisible = (id: string) => {
    const l = doc.layers.find((x) => x.id === id);
    patchLayer(id, { visible: l?.visible === false });
  };

  // ── Drag to reposition ───────────────────────────────────────────────────
  const onLayerPointerDown = (e: React.PointerEvent, layer: Layer) => {
    if (layer.type === 'background' || editingId === layer.id) return;
    setSelectedId(layer.id);
    const bbox = (layer as Exclude<Layer, { type: 'background' }>).bbox;
    setDrag({ id: layer.id, startX: e.clientX, startY: e.clientY, origX: bbox.x, origY: bbox.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onLayerPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const layer = doc.layers.find((l) => l.id === drag.id);
    if (!layer || layer.type === 'background') return;
    patchLayer(drag.id, { bbox: { ...layer.bbox, x: Math.round(drag.origX + dx), y: Math.round(drag.origY + dy) } } as Partial<Layer>);
  };
  const onLayerPointerUp = (e: React.PointerEvent) => {
    if (drag) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      setDrag(null);
    }
  };

  const handleExport = async () => {
    setSaving(true);
    setError('');
    setSelectedId(null);
    setEditingId(null);
    // Let the deselect re-render commit before capturing (drops selection outline).
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const node = previewRef.current;
      if (!node) throw new Error('미리보기를 찾을 수 없습니다');
      // Capture at full canvas resolution: the node is scaled down for preview,
      // so up-scale by the inverse of the preview scale.
      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: doc.canvas.w / node.offsetWidth,
        cacheBust: true,
      });
      const a = window.document.createElement('a');
      a.href = dataUrl;
      a.download = `cardnews-${Date.now()}.jpg`;
      a.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Re-roll the AI background for the current theme, keeping all text layers.
  const regenerateBackground = async () => {
    if (!theme) return;
    setRegenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '배경 생성 실패');
      const bg = doc.layers.find((l) => l.type === 'background');
      if (bg) {
        patchLayer(bg.id, { source: 'ai', value: data.url } as Partial<Layer>);
      } else {
        setDoc((d) => ({ ...d, layers: [{ id: 'bg', type: 'background', source: 'ai', value: data.url, overlayOpacity: 0.45, z: 0 }, ...d.layers] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div
        ref={previewRef}
        onPointerMove={onLayerPointerMove}
        onPointerUp={onLayerPointerUp}
        onClick={(e) => { if (e.target === e.currentTarget) { setSelectedId(null); setEditingId(null); } }}
        style={{
          position: 'relative',
          width: previewWidth,
          height: previewHeight,
          fontFamily: "'Noto Sans KR', sans-serif",
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {sorted.map((layer) =>
          renderLayer(layer, {
            scale,
            isSelected: layer.id === selectedId,
            isEditing: layer.id === editingId,
            onPointerDown: onLayerPointerDown,
            onSelect: () => setSelectedId(layer.id),
            onStartEdit: () => { setSelectedId(layer.id); setEditingId(layer.id); },
            onCommitText: (content) => { updateText(layer.id, content); setEditingId(null); },
          }),
        )}
      </div>

      {/* Selected text layer controls */}
      {selected && selected.type === 'text' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: '#666' }}>글자</span>
          <button onClick={() => patchLayer(selected.id, { fontSize: Math.max(12, (selected as TextLayer).fontSize - 6) } as Partial<TextLayer>)} style={ctrlBtn}>A−</button>
          <span style={{ fontSize: 12, width: 36, textAlign: 'center' }}>{Math.round((selected as TextLayer).fontSize)}</span>
          <button onClick={() => patchLayer(selected.id, { fontSize: (selected as TextLayer).fontSize + 6 } as Partial<TextLayer>)} style={ctrlBtn}>A+</button>
          <input
            type="color"
            value={toHexColor((selected as TextLayer).color)}
            onChange={(e) => patchLayer(selected.id, { color: e.target.value } as Partial<TextLayer>)}
            style={{ width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
            title="글자 색"
          />
        </div>
      )}

      {/* Layer visibility chips */}
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

      <p style={{ fontSize: 13, color: '#666', margin: 0, textAlign: 'center' }}>
        💡 레이어를 드래그해 옮기고, 텍스트는 더블클릭해 수정하세요. 칩으로 레이어를 켜고 끌 수 있어요.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {theme && (
          <button
            onClick={regenerateBackground}
            disabled={regenerating || saving}
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              border: '1px solid #ff6b35',
              background: '#fff',
              color: '#ff6b35',
              fontWeight: 700,
              fontSize: 15,
              cursor: regenerating || saving ? 'default' : 'pointer',
              opacity: regenerating || saving ? 0.6 : 1,
            }}
          >
            {regenerating ? '배경 생성 중…' : '🔄 AI 배경 다시 생성'}
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={saving || regenerating}
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            background: saving ? '#999' : '#ff6b35',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: saving || regenerating ? 'default' : 'pointer',
          }}
        >
          {saving ? '고화질 렌더링 중…' : '✨ 고화질로 저장하기'}
        </button>
      </div>
      {error && <p style={{ color: '#d33', fontSize: 13 }}>{error}</p>}
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  width: 36,
  height: 28,
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#fff',
  cursor: 'pointer',
};

function toHexColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#ffffff';
}

interface RenderOpts {
  scale: number;
  isSelected: boolean;
  isEditing: boolean;
  onPointerDown: (e: React.PointerEvent, layer: Layer) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onCommitText: (content: string) => void;
}

function renderLayer(layer: Layer, o: RenderOpts): React.ReactNode {
  if (layer.visible === false) return null;
  const z = layer.z;
  const { scale } = o;
  const outline = o.isSelected ? '2px solid #ff6b35' : undefined;

  switch (layer.type) {
    case 'background': {
      const bg =
        layer.source === 'image' || layer.source === 'ai'
          ? { backgroundImage: `url('${proxied(layer.value)}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
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
          onPointerDown={(e) => o.onPointerDown(e, layer)}
          style={{
            position: 'absolute',
            left: layer.bbox.x * scale,
            top: layer.bbox.y * scale,
            width: layer.bbox.w * scale,
            height: layer.bbox.h * scale,
            zIndex: z,
            backgroundImage: `url('${proxied(layer.src)}')`,
            backgroundSize: layer.fit ?? 'cover',
            backgroundPosition: 'center',
            borderRadius: (layer.radius ?? 0) * scale,
            outline,
            cursor: 'move',
          }}
        />
      );
    case 'text':
      return (
        <div
          key={layer.id}
          contentEditable={o.isEditing}
          suppressContentEditableWarning
          onPointerDown={(e) => o.onPointerDown(e, layer)}
          onDoubleClick={o.onStartEdit}
          onBlur={(e) => o.isEditing && o.onCommitText((e.currentTarget.innerText ?? '').replace(/\n$/, ''))}
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
            outline: outline ?? 'none',
            cursor: o.isEditing ? 'text' : 'move',
            whiteSpace: 'pre-wrap',
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
          onPointerDown={(e) => o.onPointerDown(e, layer)}
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
            outline,
            cursor: 'move',
          }}
        />
      );
    }
    default:
      return null;
  }
}
