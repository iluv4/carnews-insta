import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { LayoutAnalysisResult, TemplateJSON } from '@/lib/types';

/**
 * POST /api/templates/from-analysis
 * LayoutAnalysis 결과를 재사용 가능한 Template JSON으로 정규화하여 DB에 저장.
 *
 * Body: { analysisId, name, category, tags? }
 * Returns: { templateId, previewUrl }
 */
export async function POST(req: Request) {
  try {
    const { analysisId, name, category, tags } = await req.json();
    if (!analysisId || !name) {
      return NextResponse.json({ error: 'analysisId and name are required' }, { status: 400 });
    }

    let session = null;
    try { session = await getServerSession(authOptions); } catch {}

    // 1) Load LayoutAnalysis
    const analysis = await prisma.layoutAnalysis.findUnique({
      where: { id: analysisId },
      include: { reference: true },
    });
    if (!analysis) {
      return NextResponse.json({ error: 'LayoutAnalysis not found' }, { status: 404 });
    }

    const raw = analysis.rawAnalysisJson as unknown as LayoutAnalysisResult;

    // 2) Normalise into TemplateJSON
    const templateJson: TemplateJSON = {
      version: 1,
      canvas: {
        width: raw.canvas?.recommended_width ?? 1080,
        height: raw.canvas?.recommended_height ?? 1350,
        ratio: raw.canvas?.detected_ratio ?? '4:5',
      },
      globalStyle: raw.global_style,
      slides: raw.slides ?? [],
      rules: raw.template_rules,
      tags: buildTags(raw, category, tags),
    };

    // 3) Generate JSONL for backward compat (legacy content field)
    const legacyContent = [
      JSON.stringify({ type: 'background_dna', ...raw.global_style?.palette }),
      JSON.stringify({ type: 'typography_dna', ...raw.global_style?.typography }),
      JSON.stringify({ type: 'canvas', ...raw.canvas }),
      JSON.stringify({ type: 'template_rules', ...raw.template_rules }),
    ].join('\n');

    // 4) Save Template
    const template = await prisma.template.create({
      data: {
        name,
        category: category || inferCategory(raw),
        tags: templateJson.tags as any,
        content: legacyContent,
        templateJson: templateJson as any,
        isPublic: false,
        version: 1,
        referenceId: analysis.referenceId,
        analysisId,
        source: analysis.reference?.sourceUrl ?? null,
        userId: session?.user ? (session.user as any).id : null,
      },
    });

    return NextResponse.json({
      templateId: template.id,
      name: template.name,
      category: template.category,
      tags: template.tags,
      templateJson,
    });

  } catch (error: any) {
    console.error('[templates/from-analysis]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function inferCategory(raw: LayoutAnalysisResult): string {
  const useCases = raw.reference_summary?.best_use_cases?.join(' ') ?? '';
  if (/카페|음식|식당|레스토랑|베이커리/.test(useCases)) return '음식점/카페';
  if (/뷰티|미용|네일|헤어|피부/.test(useCases)) return '뷰티/코스메틱';
  if (/스튜디오|사진|촬영/.test(useCases)) return '사진관/스튜디오';
  if (/보험|금융|투자/.test(useCases)) return '보험/금융';
  if (/교육|학원|강의/.test(useCases)) return '교육/정보';
  if (/패션|의류|라이프/.test(useCases)) return '패션/라이프스타일';
  return '기타';
}

function buildTags(
  raw: LayoutAnalysisResult,
  category?: string,
  extraTags?: Record<string, string[]>
): Record<string, string[]> {
  const mood = raw.reference_summary?.overall_mood ?? [];
  const useCases = raw.reference_summary?.best_use_cases ?? [];
  const layouts = raw.slides?.map(s => s.layout_type) ?? [];

  return {
    industry: useCases,
    mood,
    layout: [...new Set(layouts)],
    purpose: inferPurpose(raw),
    ...(extraTags ?? {}),
  };
}

function inferPurpose(raw: LayoutAnalysisResult): string[] {
  const roles = raw.slides?.map(s => s.role) ?? [];
  const purposes: string[] = [];
  if (roles.includes('offer')) purposes.push('promotion');
  if (roles.includes('cta')) purposes.push('conversion');
  if (roles.includes('tip') || roles.includes('info')) purposes.push('education');
  if (roles.includes('cover')) purposes.push('awareness');
  return purposes;
}
