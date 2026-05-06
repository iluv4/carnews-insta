import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export const maxDuration = 60;

const CHROMIUM_REMOTE_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // 로컬: 시스템 Chrome 사용
    const localChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
    ];
    return puppeteer.launch({
      executablePath: localChromePaths.find(p => {
        try { require('fs').accessSync(p); return true; } catch { return false; }
      }) || localChromePaths[0],
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  // Vercel: @sparticuz/chromium 사용
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath: await chromium.executablePath(CHROMIUM_REMOTE_URL),
    headless: true,
  });
}

export async function POST(req: Request) {
  const { query, placeId } = await req.json();

  if (!query && !placeId) {
    return NextResponse.json({ error: '장소명(query) 또는 placeId가 필요합니다.' }, { status: 400 });
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });

    // 1) 검색 페이지 이동
    const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(query || '')}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // 2) 검색결과 iframe 진입
    await page.waitForSelector('iframe#searchIframe', { timeout: 15000 });
    const searchFrame = page.frames().find(f => f.name() === 'searchIframe') ||
      (await page.$('iframe#searchIframe').then(el => el?.contentFrame()));

    if (!searchFrame) throw new Error('searchIframe을 찾을 수 없습니다.');

    // 3) 첫 번째 결과 클릭
    await searchFrame.waitForSelector('li.UEzoS', { timeout: 10000 });
    await searchFrame.click('li.UEzoS:first-child');

    // 4) 상세 iframe 진입
    await page.waitForSelector('iframe#entryIframe', { timeout: 15000 });
    const entryFrame = page.frames().find(f => f.name() === 'entryIframe') ||
      (await page.$('iframe#entryIframe').then(el => el?.contentFrame()));

    if (!entryFrame) throw new Error('entryIframe을 찾을 수 없습니다.');

    // 5) 사진 탭 클릭
    await entryFrame.waitForSelector('a[href*="photo"], span.veBoZ', { timeout: 10000 });
    const photoTab = await entryFrame.$('a[href*="photo"]') || await entryFrame.$('span.veBoZ');
    if (photoTab) await photoTab.click();

    await new Promise(r => setTimeout(r, 2000));

    // 6) 이미지 URL 수집
    const imageUrls: string[] = await entryFrame.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[src*="pstatic.net"], img[src*="naverusercontent"]'));
      return imgs
        .map((img) => (img as HTMLImageElement).src)
        .filter(src => src && src.startsWith('http') && !src.includes('icon') && !src.includes('logo'))
        .slice(0, 30);
    });

    await browser.close();

    return NextResponse.json({ images: imageUrls, count: imageUrls.length });

  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    console.error('[naver-photos]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
