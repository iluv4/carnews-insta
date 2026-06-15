'use client';

import { useEffect, useState } from 'react';
import { PERSONAS } from '@/lib/prompts';

// Self-contained demo of the RAG + multi-agent pipeline. Streams Server-Sent
// Events from /api/agent-generate (which proxies the FastAPI + LangGraph
// service) and shows each graph node firing in real time, then the final card.
type NodeEvent = { node: string; update: Record<string, unknown> };

type SlideCard = {
  index: number;
  role?: string;
  copy?: CoverCopy;
  image_prompt?: string;
  design_brief?: Record<string, unknown>;
  card_image_b64?: string | null;
  score?: number;
  text_score?: number;
};

type ReviseInfo = { before: number | null; after: number | null; human: number };

type DonePayload = {
  copy?: { slides?: Array<Record<string, unknown>> };
  examples?: Array<{ template_id: string; score: number; summary: string }>;
  // The full deck — one rendered background per slide (fan-out result).
  cards?: SlideCard[];
  image_prompt?: string;
  card_image_b64?: string | null;
  score?: number;
  text_score?: number;
  ocr_text?: string;
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

// Bake-in pivot (2026-06-13): the card now arrives with its Korean text already
// rendered INTO the image, so we show it as-is — no CSS text overlay (that would
// double the text). The copy overlay below is only a no-key dev fallback, used
// when the image model didn't run and we have copy but no pixels.
function CardPreview({
  imageB64,
  cover,
  brand,
}: {
  imageB64: string | null;
  cover: CoverCopy;
  brand?: string;
}) {
  // Real (baked) card: the image IS the finished card. Display it untouched.
  if (imageB64) {
    return (
      <img
        src={`data:image/png;base64,${imageB64}`}
        alt={cover.title || '생성된 카드'}
        style={{
          marginTop: 12,
          width: 360,
          aspectRatio: '2 / 3',
          objectFit: 'cover',
          borderRadius: 12,
          border: '1px solid #eee',
          display: 'block',
        }}
      />
    );
  }

  // ── Dev fallback only (no OPENAI_API_KEY → no image): preview the copy as a
  //    CSS overlay so the page is still useful offline. Never shown in prod.
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

// Star rating (1–5 → 0–10) + comment. Submitting calls /api/agent-revise, which
// re-renders this one card from the human's feedback and logs it. This is the
// human-in-the-loop critic: a person's eyes drive the same revision loop the
// automated Art Director normally does.
function FeedbackWidget({
  topic,
  card,
  examples,
  onRevised,
}: {
  topic: string;
  card: SlideCard;
  examples: Array<{ template_id: string; score: number; summary: string }>;
  onRevised: (index: number, newCard: SlideCard, info: ReviseInfo) => void;
}) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // When this card first appeared — the human's review/edit time is an edit-cost metric.
  const [shownAt] = useState(() => Date.now());

  async function submit() {
    if (!stars || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const cover = (card.copy ?? {}) as CoverCopy;
      const res = await fetch('/api/agent-revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          brand: cover.brand,
          slide: card.copy ?? {},
          examples,
          design_brief: card.design_brief ?? {},
          image_prompt: card.image_prompt,
          auto_score_before: card.score ?? null,
          render_image: true,
          feedback: {
            score: stars * 2, // 5 stars → 10
            notes: comment.trim() ? [comment.trim()] : [],
            seconds: (Date.now() - shownAt) / 1000,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'revise failed');
      onRevised(card.index, data.card as SlideCard, {
        before: data.auto_score_before ?? null,
        after: data.auto_score_after ?? null,
        human: data.human_score ?? stars * 2,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        width: 360,
        padding: 10,
        border: '1px solid #eee',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', fontWeight: 700 }}>내 평가</span>
        <div role="radiogroup" aria-label="별점" style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`${n}점`}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              disabled={busy}
              style={{
                border: 0,
                background: 'transparent',
                cursor: busy ? 'default' : 'pointer',
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
                color: (hover || stars) >= n ? '#f59e0b' : '#d1d5db',
              }}
            >
              ★
            </button>
          ))}
        </div>
        {stars > 0 && <span style={{ fontSize: 12, color: '#888' }}>{stars * 2}/10</span>}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="고칠 점을 적어주세요 (예: 글자를 더 키우고 대비를 높여줘)"
        disabled={busy}
        rows={2}
        style={{
          width: '100%',
          marginTop: 8,
          padding: 8,
          border: '1px solid #ddd',
          borderRadius: 8,
          fontSize: 13,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <button
          onClick={submit}
          disabled={!stars || busy}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: 0,
            background: !stars || busy ? '#999' : '#111',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: !stars || busy ? 'default' : 'pointer',
          }}
        >
          {busy ? '반영 중…' : '피드백 반영 → 재생성'}
        </button>
        {err && <span style={{ color: '#c00', fontSize: 12 }}>⚠️ {err}</span>}
      </div>
    </div>
  );
}

type AgentHealth = {
  ok: boolean;
  embedding: 'active' | 'lexical-fallback' | 'unknown';
  openai?: boolean | null;
  templates_indexed?: number | null;
  embedded?: number | null;
  agent_url?: string;
  error?: string;
};

// Live "is embedding actually on?" indicator — polls /api/agent-health (which
// proxies the agent-service /rag/info) so the deployment's real state is visible
// at a glance instead of having to curl the Python service directly.
function EmbeddingStatus() {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/agent-health', { cache: 'no-store' });
        const data = (await res.json()) as AgentHealth;
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth({ ok: false, embedding: 'unknown', error: 'fetch failed' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tone =
    loading || !health
      ? { dot: '#999', bg: '#f3f4f6', fg: '#555', label: '임베딩 상태 확인 중…' }
      : health.embedding === 'active'
        ? {
            dot: '#16a34a',
            bg: '#ecfdf5',
            fg: '#065f46',
            label: `임베딩 ON · ${health.embedded ?? 0}/${health.templates_indexed ?? 0} 벡터`,
          }
        : health.embedding === 'lexical-fallback'
          ? {
              dot: '#f59e0b',
              bg: '#fffbeb',
              fg: '#92400e',
              label: `임베딩 OFF · 렉시컬 폴백 (${health.templates_indexed ?? 0} 템플릿)`,
            }
          : { dot: '#dc2626', bg: '#fef2f2', fg: '#991b1b', label: 'agent-service 연결 안 됨' };

  return (
    <span
      title={
        health
          ? `embedding=${health.embedding} · openai=${String(health.openai)} · ${health.agent_url ?? ''}${health.error ? ` · ${health.error}` : ''}`
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span
        style={{ width: 9, height: 9, borderRadius: '50%', background: tone.dot, flexShrink: 0 }}
      />
      {tone.label}
    </span>
  );
}

const NODE_LABEL: Record<string, string> = {
  planner: '🧭 Planner — 슬라이드 구성',
  retriever: '🔎 Retriever — RAG 검색',
  copywriter: '✍️ Copywriter — 카피 생성',
  designer: '🎨 Designer — 카드 프롬프트(텍스트 박기)',
  image_gen: '🖼️ Image — 완성 카드 생성(텍스트 포함)',
  ocr_gate: '🔡 OCR Gate — 글자 정확도 검증',
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
  // Human-in-the-loop revisions, keyed by slide index: the regenerated card and
  // the auto-score before/after so the human-driven improvement is visible.
  const [revised, setRevised] = useState<Record<number, SlideCard>>({});
  const [revInfo, setRevInfo] = useState<Record<number, ReviseInfo>>({});

  function applyRevision(index: number, newCard: SlideCard, info: ReviseInfo) {
    setRevised((prev) => ({ ...prev, [index]: { ...newCard, index } }));
    setRevInfo((prev) => ({ ...prev, [index]: info }));
  }

  // 프롬프트 다듬기 상태: 선택한 페르소나, 다듬는 중 여부, 변경 설명, 되돌리기용 원본.
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [prevTopic, setPrevTopic] = useState<string | null>(null);

  async function refine() {
    if (!topic.trim() || refining) return;
    setRefining(true);
    setRefineNote(null);
    try {
      const res = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: topic, personaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'refine failed');
      setPrevTopic(topic);
      setTopic(data.refined);
      setRefineNote(data.notes || `${data.persona?.label ?? ''} 관점으로 다듬었어요.`);
    } catch (e) {
      setRefineNote(`⚠️ 다듬기 실패: ${(e as Error).message}`);
    } finally {
      setRefining(false);
    }
  }

  function undoRefine() {
    if (prevTopic === null) return;
    setTopic(prevTopic);
    setPrevTopic(null);
    setRefineNote(null);
  }

  async function run() {
    setRunning(true);
    setEvents([]);
    setDone(null);
    setError(null);
    setRevised({});
    setRevInfo({});
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
        Planner → Retriever(RAG) → Copywriter → Designer → 완성 카드 → OCR Gate → Art Director → (loop)
        <br />
        <span style={{ fontSize: 12 }}>※ 한국어 텍스트를 이미지에 직접 굽고(박기), OCR 게이트가 글자 정확도를 검증해 통과할 때까지 재생성</span>
      </p>

      <div style={{ marginTop: 12 }}>
        <EmbeddingStatus />
      </div>

      {/* 페르소나(역할) 선택 — 누르면 다듬기 단계에서 해당 역할이 자동 부여된다. */}
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
          ① 나는 누구? (역할을 고르면 그 관점으로 다듬어져요)
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERSONAS.map((p) => {
            const active = p.id === personaId;
            return (
              <button
                key={p.id}
                onClick={() => setPersonaId(p.id)}
                title={p.guide}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: active ? '1px solid #111' : '1px solid #ddd',
                  background: active ? '#111' : '#fff',
                  color: active ? '#fff' : '#333',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {p.emoji} {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#666', margin: '16px 0 6px' }}>
        ② 주제를 대충 적고 ✨ 다듬기를 눌러보세요
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="대충 입력해도 돼요 (예: 신형 전기차 나옴)"
          style={{ flex: 1, minWidth: 240, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button
          onClick={refine}
          disabled={refining || running || !topic.trim()}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #111',
            background: '#fff',
            color: refining || !topic.trim() ? '#999' : '#111',
            fontWeight: 700,
            cursor: refining || !topic.trim() ? 'default' : 'pointer',
          }}
        >
          {refining ? '다듬는 중…' : '✨ 다듬기'}
        </button>
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

      {refineNote && (
        <p style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
          {refineNote.startsWith('⚠️') ? refineNote : `✨ ${refineNote}`}
          {prevTopic !== null && (
            <button
              onClick={undoRefine}
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid #ddd',
                background: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              되돌리기
            </button>
          )}
        </p>
      )}

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
            디자인 <b>{done.score ?? '—'}</b> · 글자정확도{' '}
            <b>{done.text_score ?? '—'}</b> · 수정 {done.revisions ?? 0}회 · provider {done.provider}
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

          {/* Baked cards: the Korean text is rendered INTO each image and the
              OCR gate verified it, so CardPreview shows the finished pixels
              as-is (no CSS text overlay — that would double the text). The deck
              is the fan-out result: one rendered card per slide. */}
          {done.cards && done.cards.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
              {done.cards.map((orig) => {
                const card = revised[orig.index] ?? orig;
                const cover = (card.copy ?? {}) as CoverCopy;
                const info = revInfo[orig.index];
                return (
                  <figure key={orig.index} style={{ margin: 0 }}>
                    <CardPreview
                      imageB64={card.card_image_b64 ?? null}
                      cover={cover}
                      brand={cover.brand}
                    />
                    <figcaption style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                      슬라이드 {card.index + 1}
                      {card.role ? ` · ${card.role}` : ''}
                      {typeof card.score === 'number' ? ` · 점수 ${card.score}` : ''}
                      {typeof card.text_score === 'number' ? ` · 글자 ${card.text_score}` : ''}
                      {info && (
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>
                          {' '}· 내 평가 {info.human}/10 반영 (자동 {info.before ?? '—'} →{' '}
                          {info.after ?? '—'})
                        </span>
                      )}
                    </figcaption>
                    <FeedbackWidget
                      topic={topic}
                      card={card}
                      examples={done.examples ?? []}
                      onRevised={applyRevision}
                    />
                  </figure>
                );
              })}
            </div>
          ) : (
            <CardPreview
              imageB64={done.card_image_b64 ?? null}
              cover={(done.copy?.slides?.[0] ?? {}) as CoverCopy}
              brand={(done.copy?.slides?.[0] as CoverCopy | undefined)?.brand}
            />
          )}
          {!done.card_image_b64 && (
            <p style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
              (완성 카드 없음 — OPENAI_API_KEY 미설정 시 카피 오버레이만 미리보기)
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
