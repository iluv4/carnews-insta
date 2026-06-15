import { NextResponse } from 'next/server';
import {
  hasUpstageKey,
  submitExtractionJob,
  retrieveExtractionJob,
  listExtractionJobs,
  generateSchema,
  mimeForExt,
  CAR_NEWS_SCHEMA,
  UPSTAGE_SUPPORTED_EXTS,
} from '@/lib/upstage';

export const maxDuration = 60;

/**
 * Upstage Universal Information Extraction (asynchronous) HTTP surface.
 *
 * POST /api/extract-document
 *   - multipart/form-data: field `file` (a PDF/이미지/DOCX…) [+ optional `schema` JSON, `autoSchema=1`]
 *   - application/json:    { fileBase64, fileName|mimeType, schema?, autoSchema? }
 *   → submits an async job, returns { requestId, status }.
 *
 * GET /api/extract-document?requestId=<id>  → poll one job → { status, result? }
 * GET /api/extract-document                 → list recent jobs
 *
 * Job lifecycle is async by design (large docs take minutes): submit returns
 * immediately, the client polls GET until status is `completed` | `failed`.
 */

function unauthorized() {
  return NextResponse.json(
    { error: 'UPSTAGE_API_KEY 미설정 — 문서 추출을 수행할 수 없습니다.' },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  if (!hasUpstageKey()) return unauthorized();

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let fileBase64: string;
    let mimeType: string;
    let fileName = 'document';
    let schema: Record<string, unknown> | undefined;
    let autoSchema = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file 필드(문서)가 필요합니다.' }, { status: 400 });
      }
      fileName = file.name || fileName;
      mimeType = file.type || mimeForExt(fileName);
      fileBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      const rawSchema = form.get('schema');
      if (typeof rawSchema === 'string' && rawSchema.trim()) schema = JSON.parse(rawSchema);
      autoSchema = form.get('autoSchema') === '1' || form.get('autoSchema') === 'true';
    } else {
      const body = await req.json();
      if (!body.fileBase64 || typeof body.fileBase64 !== 'string') {
        return NextResponse.json({ error: 'fileBase64(문서 base64)가 필요합니다.' }, { status: 400 });
      }
      // Accept either a bare base64 string or a data: URL.
      fileBase64 = body.fileBase64.includes(',') ? body.fileBase64.slice(body.fileBase64.indexOf(',') + 1) : body.fileBase64;
      fileName = body.fileName || fileName;
      mimeType = body.mimeType || mimeForExt(fileName);
      schema = body.schema;
      autoSchema = body.autoSchema === true || body.autoSchema === '1';
    }

    // Guard obviously-unsupported types early (Upstage will 4xx otherwise).
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
    if (ext && !UPSTAGE_SUPPORTED_EXTS.includes(ext as (typeof UPSTAGE_SUPPORTED_EXTS)[number])) {
      return NextResponse.json(
        { error: `지원하지 않는 형식: ${ext}. 지원: ${UPSTAGE_SUPPORTED_EXTS.join(', ')}` },
        { status: 415 },
      );
    }

    // Schema resolution: explicit > auto-generated > default car-news schema.
    if (!schema) {
      schema = autoSchema
        ? await generateSchema(fileBase64, mimeType)
        : (CAR_NEWS_SCHEMA as unknown as Record<string, unknown>);
    }

    const requestId = await submitExtractionJob({ fileBase64, mimeType, schema });
    return NextResponse.json({ requestId, status: 'submitted' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!hasUpstageKey()) return unauthorized();

  try {
    const requestId = new URL(req.url).searchParams.get('requestId');
    if (requestId) {
      const job = await retrieveExtractionJob(requestId);
      return NextResponse.json({
        requestId: job.id || requestId,
        status: job.status,
        result: job.result ?? null,
        ...(job.failureMessage ? { failureMessage: job.failureMessage } : {}),
      });
    }
    const jobs = await listExtractionJobs();
    return NextResponse.json({
      jobs: jobs.map((j) => ({ requestId: j.id, status: j.status })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
