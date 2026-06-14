import { NextResponse } from 'next/server';

// Surfaces the Python agent-service's embedding/RAG status through the public
// web app, so "is embedding actually live on the deployment?" is answerable
// without shelling into the agent container. Thin pass-through: it fans out to
// the agent's /healthz + /rag/info and folds them into one snapshot.
//
//   GET /api/agent-health
//   → { ok, embedding: "active" | "lexical-fallback" | "unknown",
//       openai, templates_indexed, embedded, models, agent_url }
export const dynamic = 'force-dynamic';

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      // Don't let a hung agent block the dashboard for long.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const [health, rag] = await Promise.all([getJson('/healthz'), getJson('/rag/info')]);

  if (!health && !rag) {
    return NextResponse.json(
      {
        ok: false,
        embedding: 'unknown',
        error: `Agent service unreachable at ${AGENT_URL}`,
        agent_url: AGENT_URL,
      },
      { status: 502 },
    );
  }

  const backend = rag?.backend as string | undefined; // "embeddings" | "lexical-fallback"
  const embedded = (rag?.embedded as number | undefined) ?? 0;
  const embedding =
    backend === 'embeddings' && embedded > 0 ? 'active' : backend ? 'lexical-fallback' : 'unknown';

  return NextResponse.json({
    ok: Boolean(health?.ok),
    embedding,
    openai: health?.openai ?? null,
    templates_indexed: rag?.templates_indexed ?? null,
    embedded,
    backend: backend ?? null,
    top_k: rag?.top_k ?? null,
    models: health?.models ?? null,
    agent_url: AGENT_URL,
  });
}
