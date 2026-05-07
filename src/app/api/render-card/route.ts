import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });

// ── Extract key style values from design DNA JSONL ────────────────────────────
function parseDNA(jsonl: string): {
  bgColor: string;
  textColor: string;
  accentColor: string;
  overlayOpacity: number;
  fontWeight: string;
} {
  const defaults = { bgColor: '#111111', textColor: '#ffffff', accentColor: '#ff6b35', overlayOpacity: 0.55, fontWeight: '800' };
  try {
    const lines = jsonl.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const palette = lines.find((l: any) => l.type === 'color_palette');
    const bg = lines.find((l: any) => l.type === 'background_dna');
    const typo = lines.find((l: any) => l.type === 'typography_dna');

    const colors: string[] = palette?.colors ?? [];
    return {
      bgColor: bg?.primary ?? colors[0] ?? defaults.bgColor,
      textColor: typo?.primary_color ?? colors.find((c: string) => /fff|white/i.test(c)) ?? defaults.textColor,
      accentColor: typo?.accent_color ?? colors[1] ?? defaults.accentColor,
      overlayOpacity: bg?.texture?.includes('glass') ? 0.4 : 0.55,
      fontWeight: typo?.weight ?? defaults.fontWeight,
    };
  } catch {
    return defaults;
  }
}

// ── Generate Korean card copy via gpt-4.1-mini ────────────────────────────────
async function generateCopy(theme: string, clientContext: string): Promise<{
  headline: string;
  subheadline: string;
  badge: string;
}> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `당신은 한국 인스타그램 카드뉴스 카피라이터입니다.
다음 주제로 임팩트 있는 카드뉴스 카피를 작성하세요.

주제: ${theme}
${clientContext ? `업체 정보:\n${clientContext}` : ''}

JSON으로만 응답:
{
  "headline": "스크롤을 멈추게 하는 굵은 한국어 헤드라인 (최대 12자, 줄바꿈 없음)",
  "subheadline": "헤드라인 보조 문구 (최대 20자)",
  "badge": "우측 상단 뱃지 텍스트 (최대 6자, 예: 신메뉴, 이벤트, 추천)"
}`,
    }],
    max_tokens: 200,
  });
  try {
    return JSON.parse(res.choices[0].message.content ?? '{}');
  } catch {
    return { headline: theme, subheadline: '지금 바로 확인하세요', badge: '추천' };
  }
}

// ── Build HTML card ───────────────────────────────────────────────────────────
function buildHtml(params: {
  headline: string;
  subheadline: string;
  badge: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  overlayOpacity: number;
  fontWeight: string;
  photoBase64?: string;
}): string {
  const { headline, subheadline, badge, bgColor, textColor, accentColor, overlayOpacity, fontWeight, photoBase64 } = params;
  const bgStyle = photoBase64
    ? `background: url('${photoBase64}') center/cover no-repeat;`
    : `background: ${bgColor};`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1024px; height: 1536px; overflow: hidden; }
  .card {
    width: 1024px; height: 1536px;
    position: relative;
    ${bgStyle}
    font-family: 'Noto Sans KR', sans-serif;
  }
  .overlay {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.05) 0%,
      rgba(0,0,0,${overlayOpacity * 0.4}) 50%,
      rgba(0,0,0,${overlayOpacity + 0.2}) 100%
    );
  }
  .badge {
    position: absolute; top: 48px; right: 48px;
    background: ${bgColor};
    color: ${accentColor};
    font-size: 36px; font-weight: 900;
    padding: 20px 28px;
    border-radius: 50%;
    width: 140px; height: 140px;
    display: flex; align-items: center; justify-content: center;
    text-align: center; line-height: 1.2;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }
  .text-area {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 60px 60px 80px;
  }
  .subheadline {
    font-size: 36px; font-weight: 400;
    color: ${textColor};
    opacity: 0.85;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }
  .headline {
    font-size: 96px; font-weight: ${fontWeight};
    color: ${textColor};
    line-height: 1.15;
    letter-spacing: -2px;
    text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    word-break: keep-all;
  }
  .accent-line {
    width: 80px; height: 6px;
    background: ${accentColor};
    border-radius: 3px;
    margin-top: 32px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="overlay"></div>
  <div class="badge">${badge}</div>
  <div class="text-area">
    <div class="subheadline">${subheadline}</div>
    <div class="headline">${headline}</div>
    <div class="accent-line"></div>
  </div>
</div>
</body>
</html>`;
}

// ── Puppeteer screenshot ──────────────────────────────────────────────────────
async function htmlToImage(html: string): Promise<string> {
  const puppeteer = (await import('puppeteer-core')).default;
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  const fs = await import('fs');
  let executablePath = '';
  for (const p of chromePaths) {
    if (fs.existsSync(p)) { executablePath = p; break; }
  }

  let launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'];
  let headless: boolean | 'new' = true;

  if (!executablePath) {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    launchArgs = chromium.args;
    headless = chromium.headless;
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless,
    args: launchArgs,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1536, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: false });
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
  } finally {
    await browser.close();
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { theme, jsonlAnalysis, clientContext, referenceImageBase64 } = await req.json();

    if (!theme) return NextResponse.json({ error: 'theme is required' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    const isDev = !apiKey || apiKey === 'dummy_key';

    // Dev fallback
    if (isDev) {
      await new Promise(r => setTimeout(r, 1000));
      return NextResponse.json({ url: referenceImageBase64 || '' });
    }

    const style = parseDNA(jsonlAnalysis ?? '');
    const [copy] = await Promise.all([
      generateCopy(theme, clientContext ?? ''),
    ]);

    const html = buildHtml({
      ...copy,
      ...style,
      photoBase64: referenceImageBase64 || undefined,
    });

    const url = await htmlToImage(html);
    return NextResponse.json({ url });

  } catch (err: any) {
    console.error('[render-card]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
