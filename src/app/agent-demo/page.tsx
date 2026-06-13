'use client';

import { useState } from 'react';

// Self-contained demo of the RAG + multi-agent pipeline. Streams Server-Sent
// Events from /api/agent-generate (which proxies the FastAPI + LangGraph
// service) and shows each graph node firing in real time, then the final card.
type NodeEvent = { node: string; update: Record<string, unknown> };

type DonePayload = {
  copy?: { slides?: Array<Record<string, unknown>> };
  examples?: Array<{ template_id: string; score: number; summary: string }>;
  image_prompt?: string;
  card_image_b64?: string | null;
  score?: number;
  critique?: Record<string, unknown>;
  revisions?: number;
  provider?: string;
};

type CoverCopy = {
  title?: string;
  subtitle?: string;
  footer?: string;
  brand?: string;
};

// Renders the cover copy as a crisp typographic overlay on top of the
// (text-free) background image. This is the whole point of the redesign:
// diffusion models garble baked-in Korean, so the text is composited in the
// browser where it stays pixel-sharp and fully controllable.
function CardPreview({
  imageB64,
  cover,
  brand,
}: {
  imageB64: string | null;
  cover: CoverCopy;
  brand?: string;
}) {
  const title = cover.title || '제목 미리보기';
  const subtitle = cover.subtitle || '';
  const footer = cover.footer || '';
  const brandText = brand || cover.brand || '';
  const bg = imageB64
    ? `center/cover no-repeat url("data:image/png;base64,${imageB64}")`
    : 'linear-gradient(135deg,#1f2937,#0f172a)';

  return (
    <div
      style={{
        marginTop: 12,
        position: 'relative',
        width: 360,
        aspectRatio: '2 / 3',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #eee',
        background: bg,
        fontFamily: "'Pretendard','Noto Sans KR',system-ui,sans-serif",
      }}
    >
      {brandText && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            backdropFilter: 'blur(4px)',
          }}
        >
          {brandText}
        </div>
      )}
      {/* bottom scrim for legible text over any photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 26 }}>
        {subtitle && (
          <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {subtitle}
          </div>
        )}
        <div
          style={{
            color: '#fff',
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
            textShadow: '0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          {title}
        </div>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: '#ff6b35', marginTop: 14 }} />
        {footer && (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 14 }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

const NODE_LABEL: Record<string, string> = {
  planner: '🧭 Planner — 슬라이드 구성',
  retriever: '🔎 Retriever — RAG 검색',
  copywriter: '✍️ Copywriter — 카피 생성',
  designer: '🎨 Designer — 이미지 프롬프트',
  image_gen: '🖼️ Image — 배경 생성(텍스트 제외)',
  art_director: '🧐 Art Director — 비평/채점',
  reviser: '🔁 Reviser — 수정 지시(루프)',
};

export default function AgentDemoPage() {
  const [topic, setTopic] = useState('제주도 흑돼지 맛집 추천');
  const [numSlides, setNumSlides] = useState(3);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const [done, setDone] = useState<DonePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setEvents([]);
    setDone(null);
    setError(null);
    try {
      const res = await fetch('/api/agent-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, num_slides: numSlides }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(e.error || 'request failed');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const evLine = chunk.split('\n').find((l) => l.startsWith('event:'));
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());
          if (event === 'node') setEvents((prev) => [...prev, data as NodeEvent]);
          else if (event === 'done') setDone(data as DonePayload);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      {/* React 19 hoists this into <head>; gives the overlay a proper KR font. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800;900&display=swap"
      />
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>🤖 Agentic Card-News (RAG + LangGraph)</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        Planner → Retriever(RAG) → Copywriter → Designer → 배경 이미지 → Art Director → (loop)
        <br />
        <span style={{ fontSize: 12 }}>※ 한국어 텍스트는 이미지에 굽지 않고 브라우저에서 또렷한 타이포로 오버레이</span>
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="주제를 입력하세요"
          style={{ flex: 1, minWidth: 240, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <input
          type="number"
          min={1}
          max={8}
          value={numSlides}
          onChange={(e) => setNumSlides(Number(e.target.value))}
          style={{ width: 72, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button
          onClick={run}
          disabled={running}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 0,
            background: running ? '#999' : '#111',
            color: '#fff',
            fontWeight: 700,
            cursor: running ? 'default' : 'pointer',
          }}
        >
          {running ? '생성 중…' : '생성'}
        </button>
      </div>

      {error && <p style={{ color: '#c00', marginTop: 12 }}>⚠️ {error}</p>}

      {events.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>그래프 진행</h2>
          <ol style={{ marginTop: 8, paddingLeft: 18 }}>
            {events.map((e, i) => (
              <li key={i} style={{ padding: '4px 0' }}>
                {NODE_LABEL[e.node] ?? e.node}
              </li>
            ))}
          </ol>
        </section>
      )}

      {done && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>결과</h2>
          <p style={{ color: '#666' }}>
            점수 <b>{done.score ?? '—'}</b> · 수정 횟수 {done.revisions ?? 0} · provider {done.provider}
          </p>

          {done.examples && done.examples.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>RAG로 검색된 참고 디자인 {done.examples.length}개</summary>
              <ul>
                {done.examples.map((ex) => (
                  <li key={ex.template_id}>
                    <code>{ex.template_id}</code> ({ex.score}) — {ex.summary}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Text is rendered as a crisp CSS overlay — never baked into the
              image — so Korean glyphs stay sharp and never garble. The diffusion
              output (if any) is used only as a text-free background. */}
          <CardPreview
            imageB64={done.card_image_b64 ?? null}
            cover={(done.copy?.slides?.[0] ?? {}) as CoverCopy}
            brand={(done.copy?.slides?.[0] as CoverCopy | undefined)?.brand}
          />
          {!done.card_image_b64 && (
            <p style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
              (배경 이미지 없음 — OPENAI_API_KEY 미설정 시 카피 오버레이만 미리보기)
            </p>
          )}

          {done.image_prompt && (
            <details style={{ marginTop: 8 }}>
              <summary>이미지 프롬프트</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{done.image_prompt}</pre>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
