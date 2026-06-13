import { NextResponse } from 'next/server';
import { runExtraction, runDocumentExtraction, hasOpenAIKey } from '@/lib/extract';
import { hasUpstageKey, SUPPORTED_EXTENSIONS, type ExtractMode } from '@/lib/upstage';

export const maxDuration = 300;

/**
 * POST /api/extract
 *
 * 두 가지 입력 모드 — 둘 다 동일한 CardBrief 를 반환한다(카드뉴스 컴포지터 입력).
 *
 * 1) 텍스트/URL (application/json)
 *    body: { input: string }  // 뉴스 URL 또는 원문 텍스트 → OpenAI IE 파이프라인
 *
 * 2) 문서/이미지 (multipart/form-data)
 *    fields: file=<스펙시트·보도자료·스크린샷·PDF>, mode?=async|sync
 *    → Upstage Universal IE 로 구조화 후 OpenAI 카피라이팅 → CardBrief
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY 미설정 — 추출을 수행할 수 없습니다.' },
        { status: 503 },
      );
    }

    // ── 문서/이미지 업로드 경로 (Upstage Universal IE) ──────────────────────
    if (contentType.includes('multipart/form-data')) {
      if (!hasUpstageKey()) {
        return NextResponse.json(
          { error: 'UPSTAGE_API_KEY 미설정 — 문서 추출을 수행할 수 없습니다.' },
          { status: 503 },
        );
      }
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 });
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `지원하지 않는 형식: .${ext} (지원: ${SUPPORTED_EXTENSIONS.join(', ')})` },
          { status: 400 },
        );
      }
      const modeRaw = String(form.get('mode') ?? 'async');
      const mode: ExtractMode = modeRaw === 'sync' ? 'sync' : 'async';
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

      const brief = await runDocumentExtraction(
        { base64, filename: file.name, mimeType: file.type || undefined },
        { mode },
      );
      return NextResponse.json({ brief, mode, ms: Date.now() - t0 });
    }

    // ── 텍스트/URL 경로 (OpenAI IE) ────────────────────────────────────────
    const { input } = await req.json();
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json({ error: 'input(텍스트 또는 URL)이 필요합니다.' }, { status: 400 });
    }

    const brief = await runExtraction(input);
    return NextResponse.json({ brief, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
