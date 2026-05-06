import { NextResponse } from 'next/server';

export const maxDuration = 60;

// ── Browser factory ───────────────────────────────────────────────────────────

async function launchBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;

  // Local dev: try system Chrome (Windows / Mac / Linux)
  if (process.env.NODE_ENV === 'development') {
    const paths = [
      // Windows
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ];
    const fs = await import('fs');
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return puppeteer.launch({
          executablePath: p,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
      }
    }
  }

  // Vercel / production — requires CHROMIUM_PATH or remote tar URL
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const remoteTar =
    process.env.CHROMIUM_PATH ||
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
  const executablePath = await chromium.executablePath(remoteTar);
  return puppeteer.launch({
    args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
    executablePath,
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
  });
}

// ── Naver Maps photo scraper ───────────────────────────────────────────────────

async function scrapeNaverPhotos(query: string): Promise<{ placeId: string; images: string[] }> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Intercept & capture API responses
    let capturedPlaceId: string | null = null;
    const capturedImageUrls: string[] = [];

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      // Block heavy resources
      const rt = req.resourceType();
      if (['stylesheet', 'font', 'media'].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      try {
        // 1) Search API → extract placeId from first result
        if (url.includes('map.naver.com/v5/api/search') && !capturedPlaceId) {
          const json = await res.json().catch(() => null);
          const places =
            json?.result?.place?.list ||
            json?.result?.business?.list ||
            json?.result?.restaurant?.list ||
            [];
          if (places.length > 0) {
            capturedPlaceId = String(places[0].id || places[0].placeId || '');
          }
        }

        // 2) Photo API responses — grab image URLs
        if (
          (url.includes('place.naver.com') || url.includes('pcmap')) &&
          url.includes('photo')
        ) {
          const json = await res.json().catch(() => null);
          if (!json) return;
          const list: any[] =
            json?.result?.photos ||
            json?.photos ||
            json?.data?.photos ||
            json?.data ||
            [];
          for (const p of list) {
            const imgUrl = p.url || p.photoUrl || p.orgUrl || p.imageUrl;
            if (imgUrl && imgUrl.includes('pstatic.net')) {
              capturedImageUrls.push(imgUrl);
            }
          }
        }
      } catch { /* ignore parse errors */ }
    });

    // 3) Navigate to Naver Maps search
    const searchUrl = 'https://map.naver.com/v5/search/' + encodeURIComponent(query);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // 4) Wait briefly for search API to fire
    await new Promise(r => setTimeout(r, 2000));

    // 5) If placeId found → navigate to photo page
    if (capturedPlaceId) {
      const photoUrl = 'https://pcmap.place.naver.com/place/' + capturedPlaceId + '/photo';
      await page.goto(photoUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));

      // Also extract img elements as fallback
      if (capturedImageUrls.length === 0) {
        const imgSrcs = await page.$$eval('img', (imgs) =>
          imgs
            .map((i) => (i as HTMLImageElement).src)
            .filter((s) => s.includes('pstatic.net') && !s.includes('thumb'))
        );
        capturedImageUrls.push(...imgSrcs);
      }
    } else {
      // Fallback: try clicking first search result
      try {
        const firstResult = await page.$('._sidebarListItem, .place_node, [data-id], .item_name');
        if (firstResult) {
          await firstResult.click();
          await new Promise(r => setTimeout(r, 3000));

          // Try extracting placeId from URL
          const currentUrl = page.url();
          const match = currentUrl.match(/place\/(\d+)/);
          if (match) capturedPlaceId = match[1];

          // Extract imgs
          const imgSrcs = await page.$$eval('img', (imgs) =>
            imgs
              .map((i) => (i as HTMLImageElement).src)
              .filter((s) => s.includes('pstatic.net'))
          );
          capturedImageUrls.push(...imgSrcs);
        }
      } catch { /* ignore */ }
    }

    return {
      placeId: capturedPlaceId || '',
      images: [...new Set(capturedImageUrls)].slice(0, 20),
    };

  } finally {
    await browser.close();
  }
}

// ── Fallback: direct API attempt (no Puppeteer) ───────────────────────────────

async function fetchNaverPhotosFallback(query: string): Promise<string[]> {
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': 'https://map.naver.com/',
  };

  // Search
  const searchRes = await fetch(
    'https://map.naver.com/v5/api/search?query=' + encodeURIComponent(query) + '&type=all',
    { headers: HEADERS }
  );
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const places =
    searchData?.result?.place?.list ||
    searchData?.result?.business?.list ||
    searchData?.result?.restaurant?.list ||
    [];
  if (places.length === 0) return [];

  const placeId = String(places[0].id || places[0].placeId || '');
  if (!placeId) return [];

  // Photos
  const photoRes = await fetch(
    'https://place.map.naver.com/place/api/lv1/place/' + placeId + '/photos?page=1&size=30',
    { headers: HEADERS }
  );
  if (!photoRes.ok) return [];
  const photoData = await photoRes.json();
  const photos: any[] = photoData?.photos || photoData?.data || [];
  return photos
    .map((p: any) => p.url || p.photoUrl || p.orgUrl)
    .filter(Boolean)
    .slice(0, 20);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { query, placeId: directPlaceId } = await req.json();

    if (!query && !directPlaceId) {
      return NextResponse.json({ error: '장소명(query) 또는 placeId가 필요합니다.' }, { status: 400 });
    }

    const searchQuery = query || directPlaceId;

    // 1) Try lightweight API first (fast, no browser overhead)
    console.log('[naver-photos] API 시도:', searchQuery);
    const apiFallback = await fetchNaverPhotosFallback(searchQuery).catch(() => []);

    if (apiFallback.length >= 3) {
      console.log('[naver-photos] API 성공:', apiFallback.length, '장');
      return NextResponse.json({ images: apiFallback, source: 'api', count: apiFallback.length });
    }

    // 2) Puppeteer fallback (heavier but more reliable)
    console.log('[naver-photos] Puppeteer 시도:', searchQuery);
    const { placeId, images } = await scrapeNaverPhotos(searchQuery);

    if (images.length === 0) {
      return NextResponse.json({
        error: '사진을 찾지 못했습니다. 장소명을 더 구체적으로 입력해주세요. (예: "소소한풍경 부암동")',
        placeId,
        hint: '직접 사진 업로드를 이용해주세요.',
      }, { status: 404 });
    }

    console.log('[naver-photos] Puppeteer 성공:', images.length, '장');
    return NextResponse.json({ images, placeId, source: 'puppeteer', count: images.length });

  } catch (err: any) {
    console.error('[naver-photos]', err.message);

    // Friendly error for browser launch failures
    if (err.message?.includes('브라우저') || err.message?.includes('chrome') || err.message?.includes('executablePath')) {
      return NextResponse.json({
        error: '브라우저 초기화 실패. CHROMIUM_PATH 환경 변수를 확인하세요.',
        hint: '📁 직접 사진 업로드를 이용해주세요.',
      }, { status: 503 });
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
