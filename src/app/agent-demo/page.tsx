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

const NODE_LABEL: Record<string, string> = {
  planner: '🧭 Planner — 슬라이드 구성',
  retriever: '🔎 Retriever — RAG 검색',
  copywriter: '✍️ Copywriter — 카피 생성',
  designer: '🎨 Designer — 이미지 프롬프트',
  image_gen: '🖼️ Image — gpt-image-2 생성',
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
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>🤖 Agentic Card-News (RAG + LangGraph)</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        Planner → Retriever(RAG) → Copywriter → Designer → gpt-image-2 → Art Director → (loop)
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

          {done.card_image_b64 ? (
            <img
              alt="generated card"
              src={`data:image/png;base64,${done.card_image_b64}`}
              style={{ marginTop: 12, maxWidth: 360, borderRadius: 12, border: '1px solid #eee' }}
            />
          ) : (
            <p style={{ color: '#999', marginTop: 12 }}>
              (이미지 없음 — OPENAI_API_KEY 미설정 시 카피/그래프만 동작)
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
