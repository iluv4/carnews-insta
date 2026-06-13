/**
 * Upstage Universal Information Extraction(IE) 클라이언트.
 *
 * 이미지/PDF/오피스 문서(스펙시트·보도자료·스크린샷 등)에서 구조화 데이터를
 * 추출한다. "Universal"이므로 사전 템플릿/학습이 필요 없다 — 스키마를 직접
 * 주거나, 문서로부터 스키마를 자동 생성(schema-generation)한 뒤 추출한다.
 *
 * 두 가지 실행 모드:
 *   - sync  : POST {IE} 에 OpenAI 호환 chat-completions 바디를 보내고 즉시 결과 수신.
 *   - async : POST {IE}/async 로 제출 → request_id 수신 → GET {IE}/requests/{id}
 *             폴링으로 완료 대기. 대용량·다중 페이지 PDF에서 sync 타임아웃을 피한다.
 *
 * 엔드포인트 출처
 * --------------
 * sync IE / schema-generation 엔드포인트는 Upstage 공식 MCP 서버 소스에서 확인했다.
 * async(`/async` 제출 + `/requests/{id}` 폴링)는 Upstage가 문서 디지털화(document-
 * digitization)에서 쓰는 비동기 규약과 동일한 패턴이다. 콘솔 문서가 봇 차단되어
 * 빌드 환경에서 직접 검증할 수 없었으므로, 모든 엔드포인트를 환경변수로 덮어쓸 수
 * 있게 두었다(scripts/upstage-extract.mjs 로 실제 키로 검증 가능).
 *
 * 인증: Authorization: Bearer ${UPSTAGE_API_KEY}
 */

const IE_BASE = process.env.UPSTAGE_IE_URL ?? 'https://api.upstage.ai/v1/information-extraction';
const IE_ASYNC_URL = process.env.UPSTAGE_IE_ASYNC_URL ?? `${IE_BASE}/async`;
const IE_REQUESTS_URL = process.env.UPSTAGE_IE_REQUESTS_URL ?? `${IE_BASE}/requests`;
const SCHEMA_GEN_URL = process.env.UPSTAGE_SCHEMA_GEN_URL ?? `${IE_BASE}/schema-generation`;
const IE_MODEL = process.env.UPSTAGE_IE_MODEL ?? 'information-extract';

/** Universal IE가 받는 입력 포맷 (공식 클라이언트 기준). */
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const SUPPORTED_EXTENSIONS = Object.keys(MIME_BY_EXT);

export interface UpstageFile {
  /** base64 인코딩된 파일 바이트 (data: 프리픽스 없이). */
  base64: string;
  /** 원본 파일명 (확장자로 MIME 추론). */
  filename: string;
  /** 명시적 MIME (있으면 우선 사용). */
  mimeType?: string;
}

export type ExtractMode = 'async' | 'sync';

export function hasUpstageKey(): boolean {
  const k = process.env.UPSTAGE_API_KEY;
  return !!k && k !== 'your_upstage_api_key_here';
}

function apiKey(): string {
  const k = process.env.UPSTAGE_API_KEY;
  if (!k) throw new Error('UPSTAGE_API_KEY 미설정');
  return k;
}

export function mimeFor(file: UpstageFile): string {
  if (file.mimeType) return file.mimeType;
  const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(
      `지원하지 않는 파일 형식: .${ext} (지원: ${SUPPORTED_EXTENSIONS.join(', ')})`,
    );
  }
  return mime;
}

/** OpenAI 호환 메시지 바디 — sync/async/schema-generation 공통. */
function buildMessages(file: UpstageFile) {
  const dataUrl = `data:${mimeFor(file)};base64,${file.base64}`;
  return [
    {
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: dataUrl } }],
    },
  ];
}

async function upstagePost(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
}

/** chat-completions 응답에서 추출 결과(JSON 문자열)를 꺼내 파싱한다. */
function parseChoiceContent(payload: unknown): Record<string, unknown> {
  const obj = payload as { choices?: { message?: { content?: unknown } }[] };
  const content = obj?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { text: content };
    }
  }
  if (content && typeof content === 'object') return content as Record<string, unknown>;
  // async 폴링 응답이 결과를 최상위에 인라인할 수도 있으므로 폴백.
  if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
  throw new Error('Upstage 응답에서 추출 결과를 찾지 못함');
}

/**
 * 문서로부터 추출 스키마 자동 생성(Universal IE의 핵심).
 * 반환값은 그대로 extraction 요청의 response_format.json_schema 로 사용한다.
 */
export async function generateSchema(file: UpstageFile): Promise<Record<string, unknown>> {
  const res = await upstagePost(SCHEMA_GEN_URL, {
    model: IE_MODEL,
    messages: buildMessages(file),
  });
  if (!res.ok) {
    throw new Error(`schema-generation 실패: ${res.status} ${await res.text()}`);
  }
  const parsed = parseChoiceContent(await res.json());
  // 응답이 { json_schema: {...} } / { schema: {...} } / 스키마 본체 중 무엇이든 수용.
  const schema =
    (parsed.json_schema as Record<string, unknown>) ??
    (parsed.schema as Record<string, unknown>) ??
    parsed;
  return schema;
}

/** 동기 추출 — 즉시 결과 반환. */
async function extractSync(
  file: UpstageFile,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await upstagePost(IE_BASE, {
    model: IE_MODEL,
    messages: buildMessages(file),
    response_format: { type: 'json_schema', json_schema: schema },
  });
  if (!res.ok) throw new Error(`information-extraction 실패: ${res.status} ${await res.text()}`);
  return parseChoiceContent(await res.json());
}

const DONE_STATUSES = new Set(['completed', 'succeeded', 'success', 'done']);
const FAIL_STATUSES = new Set(['failed', 'error', 'expired', 'cancelled', 'canceled']);

/** 비동기 추출 — 제출 후 request_id 폴링. */
async function extractAsync(
  file: UpstageFile,
  schema: Record<string, unknown>,
  { pollIntervalMs = 2000, timeoutMs = 240_000 }: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<Record<string, unknown>> {
  const submit = await upstagePost(IE_ASYNC_URL, {
    model: IE_MODEL,
    messages: buildMessages(file),
    response_format: { type: 'json_schema', json_schema: schema },
  });
  if (!submit.ok) {
    throw new Error(`async 제출 실패: ${submit.status} ${await submit.text()}`);
  }
  const { request_id } = (await submit.json()) as { request_id?: string };
  if (!request_id) throw new Error('async 응답에 request_id 없음');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const res = await fetch(`${IE_REQUESTS_URL}/${request_id}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`폴링 실패: ${res.status} ${await res.text()}`);
    const payload = (await res.json()) as Record<string, unknown>;
    const status = String(payload.status ?? '').toLowerCase();

    if (DONE_STATUSES.has(status) || (!status && payload.choices)) {
      return parseChoiceContent(payload);
    }
    if (FAIL_STATUSES.has(status)) {
      throw new Error(`async 추출 실패(status=${status}): ${JSON.stringify(payload).slice(0, 500)}`);
    }
    // submitted / scheduled / started / processing → 계속 폴링
  }
  throw new Error(`async 추출 타임아웃 (${timeoutMs}ms, request_id=${request_id})`);
}

/**
 * Universal IE 진입점.
 * 스키마 미지정 시 schema-generation 으로 자동 생성한 뒤 추출한다.
 */
export async function extractStructured(
  file: UpstageFile,
  opts: { schema?: Record<string, unknown>; mode?: ExtractMode } = {},
): Promise<{ data: Record<string, unknown>; schema: Record<string, unknown>; mode: ExtractMode }> {
  const mode = opts.mode ?? 'async';
  const schema = opts.schema ?? (await generateSchema(file));
  const data = mode === 'sync' ? await extractSync(file, schema) : await extractAsync(file, schema);
  return { data, schema, mode };
}
