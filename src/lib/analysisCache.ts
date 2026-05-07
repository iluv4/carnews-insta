import { prisma } from '@/lib/prisma';

function normalise(url: string): string {
  return url.trim().replace(/\/+$/, '').split('?')[0].toLowerCase();
}

function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : normalise(url);
}

export async function getCachedAnalysis(key: string): Promise<string | undefined> {
  try {
    const shortcode = extractShortcode(key);
    const row = await prisma.analysisCache.findUnique({ where: { shortcode } });
    return row?.jsonlData ?? undefined;
  } catch {
    return undefined;
  }
}

export async function setCachedAnalysis(key: string, analysis: string, imageUrl?: string): Promise<void> {
  try {
    const shortcode = extractShortcode(key);
    await prisma.analysisCache.upsert({
      where: { shortcode },
      update: { jsonlData: analysis, imageUrl: imageUrl ?? null, updatedAt: new Date() },
      create: { shortcode, instagramUrl: normalise(key), jsonlData: analysis, imageUrl: imageUrl ?? null },
    });
  } catch (e) {
    console.error('[analysisCache] DB write failed:', e);
  }
}
