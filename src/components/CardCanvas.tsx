'use client';

import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import type { FabricSpec, FabricObjSpec } from '@/lib/fabricSpec';
import { proxiedImageUrl } from '@/lib/imageProxy';

interface CardCanvasProps {
  spec: FabricSpec;
  onPng?: (dataUrl: string) => void;
  displayWidth?: number;
}

function placeBackgroundImage(canvas: fabric.Canvas, src: string, fit: 'cover' | 'contain') {
  return fabric.Image.fromURL(proxiedImageUrl(src), { crossOrigin: 'anonymous' }).then((img) => {
    if (!img) return;
    const scale =
      fit === 'cover'
        ? Math.max(canvas.width! / (img.width || 1), canvas.height! / (img.height || 1))
        : Math.min(canvas.width! / (img.width || 1), canvas.height! / (img.height || 1));
    img.set({
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });
    canvas.backgroundImage = img;
    canvas.renderAll();
  });
}

// Fabric.js v6+ default `originX`/`originY` is "center" — that means `left`/`top`
// are interpreted as the OBJECT'S CENTER, not its top-left. We pin everything to
// "left"/"top" so that fabricSpec coordinates behave like CSS box positions.
function addObject(canvas: fabric.Canvas, obj: FabricObjSpec) {
  if (obj.type === 'rect') {
    canvas.add(
      new fabric.Rect({
        left: obj.left,
        top: obj.top,
        originX: 'left',
        originY: 'top',
        width: obj.width,
        height: obj.height,
        fill: obj.fill,
        rx: obj.rx ?? 0,
        ry: obj.rx ?? 0,
        selectable: false,
        evented: false,
      })
    );
  } else if (obj.type === 'text') {
    const t = new fabric.Textbox(obj.text, {
      left: obj.left,
      top: obj.top,
      originX: 'left',
      originY: 'top',
      fontSize: obj.fontSize,
      fontWeight: obj.fontWeight as any,
      fill: obj.fill,
      fontFamily: obj.fontFamily || 'Pretendard',
      textAlign: obj.textAlign || 'left',
      lineHeight: obj.lineHeight ?? 1.3,
      width: obj.width ?? 800,
      shadow: obj.shadow,
      selectable: false,
      evented: false,
      // Korean word-wrap: split by grapheme so long Korean phrases without spaces
      // don't overflow. Latin still breaks on spaces because Fabric prefers space
      // boundaries first when graphemeSplit is on.
      splitByGrapheme: true,
    } as any);
    canvas.add(t);
  } else if (obj.type === 'image') {
    fabric.Image.fromURL(proxiedImageUrl(obj.src), { crossOrigin: 'anonymous' }).then((img) => {
      if (!img) return;
      img.set({
        left: obj.left,
        top: obj.top,
        originX: 'left',
        originY: 'top',
        scaleX: obj.width / (img.width || 1),
        scaleY: obj.height / (img.height || 1),
        selectable: false,
        evented: false,
      });
      canvas.add(img);
      canvas.renderAll();
    });
  }
}

export default function CardCanvas({ spec, onPng, displayWidth = 360 }: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPngRef = useRef<string>('');

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: spec.width,
      height: spec.height,
      backgroundColor:
        spec.background.type === 'color' ? spec.background.color : '#0a0a0a',
      selection: false,
    });

    let cancelled = false;

    const buildOverlay = () => {
      if (!spec.overlay) return;
      canvas.add(
        new fabric.Rect({
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          width: spec.width,
          height: spec.height,
          fill: spec.overlay.color,
          selectable: false,
          evented: false,
        })
      );
    };

    const buildObjects = () => {
      spec.objects.forEach((obj) => addObject(canvas, obj));
    };

    const finalize = () => {
      if (cancelled) return;
      canvas.renderAll();
      // Wait one frame for any async images then export
      setTimeout(() => {
        if (cancelled) return;
        const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
        if (dataUrl !== lastPngRef.current) {
          lastPngRef.current = dataUrl;
          onPng?.(dataUrl);
        }
      }, 250);
    };

    const init = async () => {
      if (spec.background.type === 'image' && spec.background.src) {
        try {
          await placeBackgroundImage(canvas, spec.background.src, spec.background.objectFit);
        } catch (err) {
          console.warn('[CardCanvas] background image failed', err);
        }
      }
      buildOverlay();
      buildObjects();
      // Async images may still be loading — give them a moment
      setTimeout(finalize, 350);
    };

    init();

    return () => {
      cancelled = true;
      canvas.dispose();
    };
  }, [spec, onPng]);

  const aspect = spec.height / spec.width;
  const displayHeight = displayWidth * aspect;

  return (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        borderRadius: 12,
        background: '#0a0a0a',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: spec.width,
          height: spec.height,
          transform: `scale(${displayWidth / spec.width})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}
