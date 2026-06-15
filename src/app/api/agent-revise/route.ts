import { NextResponse } from 'next/server';

// Proxies the browser to the Python agent service's /revise endpoint (the
// human-in-the-loop revision). Unlike /agent-generate this is a plain JSON
// round-trip — the human's rating + comment re-render one card and the service
// logs the feedback for metrics + preference learning.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { topic, feedback } = (body ?? {}) as {
    topic?: string;
    feedback?: { score?: number };
  };
  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }
  if (!feedback || typeof feedback.score !== 'number') {
    return NextResponse.json({ error: 'feedback.score is required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT_URL}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Agent service unreachable at ${AGENT_URL}: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json({ error: `Agent service error: ${text}` }, { status: 502 });
  }
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
