/**
 * Upstage Universal Information Extraction — *asynchronous* client.
 *
 * Wraps Upstage's async "Universal Extraction" API so large documents
 * (PDF / DOCX / PPTX / XLSX / scanned images) can be turned into structured
 * JSON without holding a request open for minutes. The flow is job-based:
 *
 *   1) submit   — POST a document (+ optional JSON schema) → returns a job id
 *   2) poll      — GET the job until status is `completed` | `failed`
 *   3) result    — read the extracted JSON off the completed job
 *
 * Why a separate path from `extract.ts`?
 * --------------------------------------
 * `extract.ts` does LLM information-extraction over *web text* (news URL → text
 * → CardBrief). Upstage Universal Extraction instead reads *binary documents*
 * (a brochure PDF, a spec-sheet image, a press-release DOCX) with layout-aware
 * OCR, which the OpenAI text path can't do. The two are complementary: this
 * module produces the same kind of structured brief, just from a file.
 *
 * Endpoint paths
 * --------------
 * Upstage's async API is documented (jobs / list / retrieve) at:
 *   https://console.upstage.ai/api/information-extraction/universal-extraction/async
 * The paths below mirror Upstage's OpenAI-compatible IE surface and its
 * document-digitization async convention. They are overridable via env so a
 * docs change is a config edit, not a code change. Responses are parsed
 * defensively (multiple field spellings) for the same reason.
 *
 * Auth: `Authorization: Bearer $UPSTAGE_API_KEY`. The key is read from the
 * environment only — never hard-code it.
 */

const BASE = process.env.UPSTAGE_BASE_URL ?? 'https://api.upstage.ai/v1';

/** Async endpoints (env-overridable; see module header). */
const ENDPOINTS = {
  /** Submit a job (Asynchronous API). */
  submit:
    process.env.UPSTAGE_IE_ASYNC_URL ??
    `${BASE}/information-extraction/async/chat/completions`,
  /** List jobs. */
  list:
    process.env.UPSTAGE_IE_JOBS_URL ?? `${BASE}/information-extraction/requests`,
  /** Retrieve one job by id (`${retrieveBase}/{id}`). */
  retrieveBase:
    process.env.UPSTAGE_IE_JOB_URL ?? `${BASE}/information-extraction/requests`,
  /** Auto-generate a schema from a document (sync helper). */
  schema:
    process.env.UPSTAGE_IE_SCHEMA_URL ??
    `${BASE}/information-extraction/schema-generation`,
} as const;

/** Default extraction model for the Universal IE API. */
const IE_MODEL = process.env.UPSTAGE_IE_MODEL ?? 'information-extract';

/** Upstage-supported input formats (max 50MB / 100 pages). */
export const UPSTAGE_SUPPORTED_EXTS = [
  '.jpeg', '.jpg', '.png', '.bmp', '.pdf', '.tiff', '.tif', '.heic', '.docx', '.pptx', '.xlsx',
] as const;

export type UpstageJobStatus =
  | 'submitted'   // accepted, queued
  | 'started'     // processing in progress (a.k.a. "processing")
  | 'processing'
  | 'completed'   // result ready
  | 'failed';     // see failureMessage

export interface UpstageJob {
  id: string;
  status: UpstageJobStatus;
  /** Parsed extraction result (present once `completed`). */
  result?: Record<string, unknown>;
  failureMessage?: string;
  raw: unknown;
}

export function hasUpstageKey(): boolean {
  const k = process.env.UPSTAGE_API_KEY;
  return !!k && k !== 'your_upstage_api_key_here' && k.trim().length > 0;
}

function apiKey(): string {
  const k = process.env.UPSTAGE_API_KEY;
  if (!k) throw new Error('UPSTAGE_API_KEY 미설정 — Upstage 추출을 수행할 수 없습니다.');
  return k;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${apiKey()}`, ...extra };
}

/** Map a filename/extension to the MIME used in the data URL. */
export function mimeForExt(nameOrExt: string): string {
  const ext = (nameOrExt.includes('.') ? nameOrExt.slice(nameOrExt.lastIndexOf('.')) : nameOrExt).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.bmp': return 'image/bmp';
    case '.tif':
    case '.tiff': return 'image/tiff';
    case '.heic': return 'image/heic';
    case '.pdf': return 'application/pdf';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default: return 'application/octet-stream';
  }
}

/** Default car-news extraction schema (mirrors CardBrief in extract.ts). */
export const CAR_NEWS_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: '문서 핵심을 요약한 한국어 헤드라인' },
    summary: { type: 'string', description: '2~3문장 요약' },
    key_points: { type: 'array', items: { type: 'string' }, description: '사실 기반 핵심 포인트' },
    entities: {
      type: 'array',
      items: { type: 'string' },
      description: '본문에 등장한 고유명사(브랜드/모델/인물 등)',
    },
    specs: {
      type: 'array',
      description: '차량/제품 사양 키-값 (예: 출력, 연비, 가격)',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
  },
} as const;

interface SubmitArgs {
  /** Base64-encoded file bytes (no data: prefix). */
  fileBase64: string;
  /** MIME type, e.g. `application/pdf`. */
  mimeType: string;
  /** JSON schema for the fields to extract. Omit to let Upstage infer. */
  schema?: Record<string, unknown>;
  schemaName?: string;
}

/** Build the OpenAI-compatible IE request body shared by sync & async. */
function buildBody({ fileBase64, mimeType, schema, schemaName }: SubmitArgs): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: IE_MODEL,
    messages: [
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } }],
      },
    ],
  };
  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: schemaName ?? 'document_schema', schema },
    };
  } else {
    // No schema → free-form JSON object (Upstage auto-keys the document).
    body.response_format = { type: 'json_object' };
  }
  return body;
}

/** Pull the job id out of a submit/list/retrieve payload (defensive). */
function jobIdOf(o: Record<string, unknown>): string | undefined {
  return (
    (o.request_id as string) ??
    (o.id as string) ??
    (o.job_id as string) ??
    (o.requestId as string) ??
    undefined
  );
}

/** Normalize status spellings into our union. */
function normStatus(s: unknown): UpstageJobStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'completed' || v === 'succeeded' || v === 'success' || v === 'done') return 'completed';
  if (v === 'failed' || v === 'error') return 'failed';
  if (v === 'started' || v === 'processing' || v === 'running') return 'processing';
  return 'submitted';
}

/** Extract the structured JSON result from a completed job payload. */
function resultOf(o: Record<string, unknown>): Record<string, unknown> | undefined {
  // Most likely: an OpenAI-style completion echoed on the job.
  const choices = o.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch { return { text: content }; }
  }
  // Or a direct `result` / `output` object/string.
  for (const key of ['result', 'output', 'data', 'extraction'] as const) {
    const val = o[key];
    if (val && typeof val === 'object') return val as Record<string, unknown>;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { /* fall through */ }
    }
  }
  return undefined;
}

function toJob(payload: unknown): UpstageJob {
  const o = (payload ?? {}) as Record<string, unknown>;
  const status = normStatus(o.status);
  return {
    id: jobIdOf(o) ?? '',
    status,
    result: status === 'completed' ? resultOf(o) : undefined,
    failureMessage: (o.failure_message as string) ?? (o.failureMessage as string) ?? undefined,
    raw: payload,
  };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upstage API ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Upstage API: 비정상 응답(JSON 아님): ${text.slice(0, 200)}`);
  }
}

/** 1) submit — create an async extraction job, returns its id. */
export async function submitExtractionJob(args: SubmitArgs): Promise<string> {
  const res = await fetch(ENDPOINTS.submit, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(buildBody(args)),
    signal: AbortSignal.timeout(60_000),
  });
  const json = await readJson(res);
  const id = jobIdOf(json);
  if (!id) throw new Error(`Upstage: 제출 응답에 job id 없음: ${JSON.stringify(json).slice(0, 200)}`);
  return id;
}

/** 2) retrieve — fetch one job by id. */
export async function retrieveExtractionJob(id: string): Promise<UpstageJob> {
  const res = await fetch(`${ENDPOINTS.retrieveBase}/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  return toJob(await readJson(res));
}

/** list — enumerate recent jobs (best-effort; shape varies). */
export async function listExtractionJobs(): Promise<UpstageJob[]> {
  const res = await fetch(ENDPOINTS.list, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await readJson(res);
  const arr =
    (json.data as unknown[]) ??
    (json.requests as unknown[]) ??
    (json.jobs as unknown[]) ??
    (Array.isArray(json) ? (json as unknown[]) : []);
  return arr.map(toJob);
}

/** Auto-generate a JSON schema for a document (optional helper, sync). */
export async function generateSchema(fileBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  const res = await fetch(ENDPOINTS.schema, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: 'schema-generate',
      messages: [
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } }],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const json = await readJson(res);
  const content = (json.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      // Upstage may wrap as { json_schema: { schema } } or return the schema directly.
      return (parsed?.json_schema?.schema as Record<string, unknown>) ?? (parsed?.schema as Record<string, unknown>) ?? parsed;
    } catch { /* fall through */ }
  }
  return CAR_NEWS_SCHEMA as unknown as Record<string, unknown>;
}

export interface RunOptions {
  schema?: Record<string, unknown>;
  schemaName?: string;
  /** Poll cadence (ms). */
  pollIntervalMs?: number;
  /** Total wait budget (ms) before giving up. */
  timeoutMs?: number;
}

/**
 * Convenience: submit → poll until terminal → return the completed job.
 * Throws on `failed` or timeout. For serverless routes prefer the
 * submit/retrieve pair + client polling to avoid long-held requests.
 */
export async function runExtractionToCompletion(
  args: { fileBase64: string; mimeType: string } & RunOptions,
): Promise<UpstageJob> {
  const { fileBase64, mimeType, schema, schemaName } = args;
  const pollIntervalMs = args.pollIntervalMs ?? 2_000;
  const timeoutMs = args.timeoutMs ?? 50_000;

  const id = await submitExtractionJob({ fileBase64, mimeType, schema, schemaName });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await retrieveExtractionJob(id);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(`Upstage 추출 실패: ${job.failureMessage ?? 'unknown error'}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Upstage 추출 시간 초과 — job ${id} 아직 미완료. 나중에 /api/extract-document?requestId=${id} 로 조회하세요.`);
}
