import { NextResponse } from 'next/server';

export const maxDuration = 60;

async function getChromePath(): Promise<string> {
  const fs = await import('fs');
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  // Serverless fallback
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const remoteTar = process.env.CHROMIUM_PATH ||
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
  return chromium.executablePath(remoteTar);
}

async function scrapeNaverPhotos(businessName: string): Promise<string[]> {
  const puppeteer = (await import('puppeteer-core')).default;
  const executablePath = await getChromePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 네이버 지도 검색
    const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(businessName)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // 검색 결과 iframe 대기
    await page.waitForSelector('iframe#searchIframe', { timeout: 8000 }).catch(() => {});

    // placeId 추출: URL 또는 API 인터셉트
    let placeId: string | null = null;

    // searchIframe 내에서 첫 번째 결과 클릭
    const frames = page.frames();
    const searchFrame = frames.find(f => f.url().includes('search')) || page.mainFrame();

    // placeId를 URL에서 추출 시도
    const currentUrl = page.url();
    const placeMatch = currentUrl.match(/place\/(\d+)/);
    if (placeMatch) placeId = placeMatch[1];

    if (!placeId) {
      // iframe 내 첫 번째 업체 링크에서 ID 추출
      for (const frame of page.frames()) {
        try {
          const id = await frame.evaluate(() => {
            const link = document.querySelector('a[href*="/place/"]') as HTMLAnchorElement | null;
            if (!link) return null;
            const m = link.href.match(/place\/(\d+)/);
            return m ? m[1] : null;
          });
          if (id) { placeId = id; break; }
        } catch { /* skip */ }
      }
    }

    if (!placeId) {
      // 직접 API로 검색
      const apiRes = await page.evaluate(async (query: string) => {
        const r = await fetch(`https://map.naver.com/v5/api/search?caller=mnd&query=${encodeURIComponent(query)}&type=all&page=1&displayCount=3&lang=ko`);
        return r.ok ? r.json() : null;
      }, businessName);

      if (apiRes?.result?.place?.list?.[0]?.id) {
        placeId = apiRes.result.place.list[0].id;
      }
    }

    if (!placeId) throw new Error(`"${businessName}" 검색 결과를 찾을 수 없습니다.`);

    // 사진 페이지로 이동
    await page.goto(`https://pcmap.place.naver.com/place/${placeId}/photo`, {
      waitUntil: 'networkidle2', timeout: 15000
    });

    // 사진 URL 추출
    const photoUrls: string[] = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
      return imgs
        .map(img => img.src)
        .filter(src =>
          src.includes('pstatic.net') &&
          !src.includes('profile') &&
          src.length > 50
        )
        .slice(0, 12);
    });

    return photoUrls;
  } finally {
    await browser.close();
  }
}

export async function POST(req: Request) {
  try {
    const { businessName } = await req.json();
    if (!businessName?.trim()) {
      return NextResponse.json({ error: '가게 이름을 입력해주세요.' }, { status: 400 });
    }

    const photos = await scrapeNaverPhotos(businessName.trim());

    if (photos.length === 0) {
      return NextResponse.json({ error: '사진을 찾을 수 없습니다. 정확한 가게 이름을 입력해주세요.' }, { status: 404 });
    }

    return NextResponse.json({ photos, count: photos.length });
  } catch (err: any) {
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
