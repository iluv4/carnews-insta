import { NextResponse } from 'next/server';

// Proxies the browser to the Python FastAPI + LangGraph agent service and
// streams its Server-Sent Events straight through. Keeping the agent
// orchestration in a separate service means this route is a thin pass-through:
// no AI logic lives here.
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

  const { topic } = (body ?? {}) as { topic?: string };
  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Agent service unreachable at ${AGENT_URL}: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText);
    return NextResponse.json({ error: `Agent service error: ${detail}` }, { status: 502 });
  }

  // Pipe the SSE stream through unchanged.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
