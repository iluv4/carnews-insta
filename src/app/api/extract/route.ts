import { NextResponse } from 'next/server';
import { runExtraction, hasOpenAIKey } from '@/lib/extract';

export const maxDuration = 60;

/**
 * POST /api/extract
 * body: { input: string }  // 뉴스 URL 또는 원문 텍스트
 * → 카드뉴스 제작용 구조화 브리프(CardBrief) 반환
 *
 * LLM 기반 정보추출(IE) 파이프라인의 HTTP 엔드포인트.
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const { input } = await req.json();
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json({ error: 'input(텍스트 또는 URL)이 필요합니다.' }, { status: 400 });
    }

    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY 미설정 — 추출을 수행할 수 없습니다.' },
        { status: 503 },
      );
    }

    const brief = await runExtraction(input);
    return NextResponse.json({ brief, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
