// Shared headless-Chrome screenshot helper. Tries a locally installed Chrome
// first (dev), falls back to the bundled @sparticuz/chromium (Vercel).
export async function htmlToImage(html: string, width = 1024, height = 1536): Promise<string> {
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

  const browser = await puppeteer.launch({
    executablePath,
    headless,
    args: launchArgs,
    defaultViewport: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: false });
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
  } finally {
    await browser.close();
  }
}
