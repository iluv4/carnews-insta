import { NextResponse } from 'next/server';

// Proxies a human-in-the-loop *resume* to the Python agent service and streams
// its SSE back. The review gate paused the run on /generate (interrupt); this
// carries the reviewer's decision (approve / revise) for the same thread_id so
// the graph continues from where it stopped. Thin pass-through, no AI logic.
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

  const { thread_id } = (body ?? {}) as { thread_id?: string };
  if (!thread_id || typeof thread_id !== 'string') {
    return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT_URL}/resume`, {
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
