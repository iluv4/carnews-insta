import { NextResponse } from 'next/server';

export const maxDuration = 120;

// Reuse same Puppeteer helper as render-card
async function htmlToJpeg(html: string, width = 1000, height = 1000): Promise<string> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let headless: any = true;
  if (!executablePath) {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    launchArgs = chromium.args;
    headless = chromium.headless;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser = await puppeteer.launch({ executablePath, headless, args: launchArgs, defaultViewport: null } as any);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false });
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
  } finally {
    await browser.close();
  }
}

interface SlidePoint {
  icon: string;
  title: string;
  desc: string;
}

interface SlideIngredient {
  name: string;
  pct: string;
  benefit: string;
}

interface SlideStep {
  no: string;
  title: string;
  desc: string;
}

interface AmazonCopy {
  slide1: { brand: string; productName: string; tagline: string };
  slide2: { header: string; points: SlidePoint[] };
  slide3: { header: string; mainIngredient: string; details: SlideIngredient[] };
  slide4: { header: string; steps: SlideStep[] };
  slide5: { header: string; beforeLabel: string; afterLabel: string; result1: string; result2: string };
  slide6: { header: string; claim: string; sub: string };
}

// GPT generates structured copy for all 6 slides
async function generateAmazonCopy(
  productName: string,
  brand: string,
  ingredients: string,
  benefits: string,
  howToUse: string,
  lang: string
): Promise<AmazonCopy> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const langGuide = lang === 'ja' ? '日本語で' : lang === 'ko' ? '한국어로' : 'in English';

  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an Amazon product listing copywriter. Generate ${langGuide} marketing copy for Amazon product images. Return JSON.`,
      },
      {
        role: 'user',
        content: `Product: ${productName}
Brand: ${brand}
Key Ingredients: ${ingredients}
Benefits: ${benefits}
How to Use: ${howToUse}

Generate Amazon listing image copy. Return JSON with this exact structure:
{
  "slide1": { "brand": "...", "productName": "...", "tagline": "..." },
  "slide2": { "header": "...", "points": [{"icon": "✓", "title": "...", "desc": "..."}] (4 items) },
  "slide3": { "header": "...", "mainIngredient": "...", "details": [{"name": "...", "pct": "...", "benefit": "..."}] (3 items) },
  "slide4": { "header": "HOW TO USE", "steps": [{"no": "01", "title": "...", "desc": "..."}] (3 items) },
  "slide5": { "header": "...", "beforeLabel": "...", "afterLabel": "...", "result1": "...", "result2": "..." },
  "slide6": { "header": "...", "claim": "...", "sub": "..." }
}`,
      },
    ],
  });

  return JSON.parse(res.choices[0].message.content!) as AmazonCopy;
}

// 6 HTML slide templates (1000x1000px, Amazon-compliant)
function slide1Html(copy: AmazonCopy['slide1'], photo: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;background:#fff;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;position:relative}
.product{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:80px}
.product img{max-width:760px;max-height:760px;object-fit:contain}
.brand{position:absolute;top:36px;left:44px;font-size:13px;letter-spacing:3px;color:#aaa;text-transform:uppercase}
.bottom{position:absolute;bottom:44px;left:0;right:0;text-align:center}
.name{font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em}
.tagline{font-size:13px;color:#888;margin-top:6px}
</style></head><body>
<div class="brand">${copy.brand}</div>
<div class="product"><img src="${photo}"/></div>
<div class="bottom"><div class="name">${copy.productName}</div><div class="tagline">${copy.tagline}</div></div>
</body></html>`;
}

function slide2Html(copy: AmazonCopy['slide2'], photo: string): string {
  const pts = copy.points
    .map(
      (p) => `
    <div class="point">
      <div class="point-icon">${p.icon}</div>
      <div class="point-text"><div class="point-title">${p.title}</div><div class="point-desc">${p.desc}</div></div>
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;background:#fafaf8;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;display:flex}
.left{width:420px;background:#f0ede8;display:flex;align-items:center;justify-content:center;padding:40px}
.left img{max-width:320px;max-height:520px;object-fit:contain}
.right{flex:1;padding:60px 48px;display:flex;flex-direction:column;justify-content:center}
.header{font-size:13px;font-weight:800;letter-spacing:0.15em;color:#c8a87a;text-transform:uppercase;margin-bottom:12px}
.title{font-size:26px;font-weight:800;color:#1a1a1a;line-height:1.3;margin-bottom:40px;letter-spacing:-0.02em}
.point{display:flex;align-items:flex-start;gap:16px;margin-bottom:28px}
.point-icon{font-size:22px;flex-shrink:0;margin-top:2px}
.point-title{font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
.point-desc{font-size:12px;color:#666;line-height:1.6}
</style></head><body>
<div class="left"><img src="${photo}"/></div>
<div class="right">
  <div class="header">FEATURE</div>
  <div class="title">${copy.header}</div>
  ${pts}
</div>
</body></html>`;
}

function slide3Html(copy: AmazonCopy['slide3'], photo: string): string {
  const details = copy.details
    .map(
      (d) => `
    <div class="ing-card">
      <div class="ing-pct">${d.pct}</div>
      <div class="ing-name">${d.name}</div>
      <div class="ing-benefit">${d.benefit}</div>
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;background:#fff;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;display:flex;flex-direction:column}
.top{height:420px;background:#f5f3ef;display:flex;align-items:center;justify-content:center;gap:60px;padding:40px 80px}
.top img{max-height:320px;max-width:280px;object-fit:contain}
.top-text{max-width:400px}
.header{font-size:13px;font-weight:800;letter-spacing:0.12em;color:#c8a87a;text-transform:uppercase;margin-bottom:10px}
.main-ing{font-size:28px;font-weight:800;color:#1a1a1a;line-height:1.3;letter-spacing:-0.02em}
.bottom{flex:1;display:flex;align-items:center;justify-content:center;gap:24px;padding:0 60px}
.ing-card{flex:1;background:#fafaf8;border:1px solid #e8e4de;border-radius:16px;padding:28px 20px;text-align:center}
.ing-pct{font-size:28px;font-weight:900;color:#c8a87a;margin-bottom:6px}
.ing-name{font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:8px}
.ing-benefit{font-size:11px;color:#888;line-height:1.6}
</style></head><body>
<div class="top">
  <img src="${photo}"/>
  <div class="top-text">
    <div class="header">KEY INGREDIENT</div>
    <div class="main-ing">${copy.mainIngredient}</div>
  </div>
</div>
<div class="bottom">${details}</div>
</body></html>`;
}

function slide4Html(copy: AmazonCopy['slide4'], photo: string): string {
  const steps = copy.steps
    .map(
      (s) => `
    <div class="step">
      <div class="step-no">${s.no}</div>
      <div class="step-content"><div class="step-title">${s.title}</div><div class="step-desc">${s.desc}</div></div>
    </div>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;background:#fff;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;display:flex}
.left{width:420px;background:#eef4f0;display:flex;align-items:center;justify-content:center;padding:40px}
.left img{max-width:300px;max-height:500px;object-fit:contain}
.right{flex:1;padding:70px 52px;display:flex;flex-direction:column;justify-content:center}
.header{font-size:13px;font-weight:800;letter-spacing:0.15em;color:#4a9a6a;text-transform:uppercase;margin-bottom:10px}
.title{font-size:30px;font-weight:900;color:#1a1a1a;letter-spacing:-0.03em;margin-bottom:44px}
.step{display:flex;align-items:flex-start;gap:20px;margin-bottom:30px}
.step-no{width:36px;height:36px;border-radius:50%;background:#4a9a6a;color:#fff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-title{font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
.step-desc{font-size:12px;color:#666;line-height:1.6}
</style></head><body>
<div class="left"><img src="${photo}"/></div>
<div class="right">
  <div class="header">USAGE</div>
  <div class="title">${copy.header}</div>
  ${steps}
</div>
</body></html>`;
}

function slide5Html(copy: AmazonCopy['slide5'], beforePhoto: string, afterPhoto: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;background:#fff;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;display:flex;flex-direction:column}
.top-bar{height:80px;display:flex;align-items:center;justify-content:center;background:#1a1a1a}
.top-title{font-size:22px;font-weight:900;color:#fff;letter-spacing:0.1em;text-transform:uppercase}
.photos{flex:1;display:flex}
.photo-col{flex:1;position:relative;overflow:hidden}
.photo-col img{width:100%;height:100%;object-fit:cover}
.label{position:absolute;top:24px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;font-size:12px;font-weight:700;padding:6px 18px;border-radius:100px;letter-spacing:0.08em}
.divider{width:4px;background:#fff;position:relative;z-index:2}
.divider::after{content:'→';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#1a1a1a;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;box-shadow:0 2px 12px rgba(0,0,0,0.2)}
.bottom{height:120px;display:flex;align-items:center;justify-content:center;gap:60px;background:#f8f8f8;border-top:1px solid #eee}
.result{text-align:center}
.result-num{font-size:22px;font-weight:900;color:#1a1a1a}
.result-text{font-size:11px;color:#888;margin-top:4px}
</style></head><body>
<div class="top-bar"><div class="top-title">${copy.header}</div></div>
<div class="photos">
  <div class="photo-col"><img src="${beforePhoto}"/><div class="label">${copy.beforeLabel}</div></div>
  <div class="divider"></div>
  <div class="photo-col"><img src="${afterPhoto}"/><div class="label">${copy.afterLabel}</div></div>
</div>
<div class="bottom">
  <div class="result"><div class="result-num">${copy.result1}</div><div class="result-text">効果実感</div></div>
  <div style="width:1px;height:40px;background:#ddd"></div>
  <div class="result"><div class="result-num">${copy.result2}</div><div class="result-text">満足度</div></div>
</div>
</body></html>`;
}

function slide6Html(copy: AmazonCopy['slide6'], photo: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;overflow:hidden;position:relative}
.bg{position:absolute;inset:0}
.bg img{width:100%;height:100%;object-fit:cover}
.overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.1) 60%,transparent 100%)}
.content{position:absolute;bottom:0;left:0;right:0;padding:60px}
.header{font-size:13px;font-weight:800;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:14px}
.claim{font-size:36px;font-weight:900;color:#fff;line-height:1.2;letter-spacing:-0.03em;margin-bottom:12px}
.sub{font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6}
</style></head><body>
<div class="bg"><img src="${photo}"/></div>
<div class="overlay"></div>
<div class="content">
  <div class="header">${copy.header}</div>
  <div class="claim">${copy.claim}</div>
  <div class="sub">${copy.sub}</div>
</div>
</body></html>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      productName,
      brand,
      ingredients,
      benefits,
      howToUse,
      lang = 'ja',
      photos = [],
    }: {
      productName: string;
      brand?: string;
      ingredients?: string;
      benefits?: string;
      howToUse?: string;
      lang?: string;
      photos?: string[];
    } = body;

    if (!productName) {
      return NextResponse.json({ error: '제품명을 입력해주세요.' }, { status: 400 });
    }

    // GPT copy generation
    const copy = await generateAmazonCopy(
      productName,
      brand || '',
      ingredients || '',
      benefits || '',
      howToUse || '',
      lang
    );

    // Photo assignment with fallback placeholder
    const placeholder =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMGVkZTgiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNiYmIiPuS6jOeUqDwvdGV4dD48L3N2Zz4=';
    const p = (i: number) => photos[i] || placeholder;

    // Generate all 6 slides sequentially (Puppeteer is single-browser)
    const htmlSlides = [
      slide1Html(copy.slide1, p(0)),
      slide2Html(copy.slide2, p(0)),
      slide3Html(copy.slide3, p(1) !== placeholder ? p(1) : p(0)),
      slide4Html(copy.slide4, p(2) !== placeholder ? p(2) : p(0)),
      slide5Html(
        copy.slide5,
        p(3) !== placeholder ? p(3) : p(0),
        p(4) !== placeholder ? p(4) : p(0)
      ),
      slide6Html(copy.slide6, p(5) !== placeholder ? p(5) : p(0)),
    ];

    const images: string[] = [];
    for (const html of htmlSlides) {
      images.push(await htmlToJpeg(html));
    }

    const slideLabels = ['메인 썸네일', '핵심 기능', '성분 상세', '사용 방법', 'Before & After', '라이프스타일'];

    return NextResponse.json({
      slides: images.map((image, i) => ({ image, label: slideLabels[i] })),
      copy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-amazon]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
