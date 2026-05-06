/**
 * 포털 프리셋 사진 다운로드 스크립트
 * 실행: node scripts/download-presets.mjs
 *
 * 각 포털의 Instagram 게시물에서 사진을 가져와
 * public/presets/{portalId}/ 에 저장합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const PORTALS = [
  {
    id: 'sosohan',
    sources: [
      // 소소한풍경 인스타 게시물 (레퍼런스 + 추가 포스트)
      'https://www.instagram.com/p/DWiwH4cAbZP/',
      'https://www.instagram.com/p/DTCNeX0kqQR/',
      'https://www.instagram.com/p/DWdnskCgYpj/',
    ],
    maxPhotos: 12,
  },
];

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function fetchJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`📡 API 서버: ${BASE_URL}`);
  console.log('⚠️  Next.js 개발 서버가 실행 중이어야 합니다 (npm run dev)\n');

  for (const portal of PORTALS) {
    const outDir = path.join('public', 'presets', portal.id);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n🗂  [${portal.id}] 처리 시작...`);
    const allImages = [];

    for (const sourceUrl of portal.sources) {
      console.log(`  → 가져오는 중: ${sourceUrl}`);
      try {
        const data = await fetchJson(`${BASE_URL}/api/instagram`, { url: sourceUrl });
        if (data.images?.length) {
          allImages.push(...data.images);
          console.log(`     ✅ ${data.images.length}장 발견`);
        } else {
          console.log(`     ⚠️  이미지 없음`);
        }
      } catch (e) {
        console.log(`     ❌ 오류: ${e.message}`);
      }
    }

    // 중복 제거 후 최대 maxPhotos장 다운로드
    const unique = [...new Set(allImages)].slice(0, portal.maxPhotos);
    console.log(`\n  📥 총 ${unique.length}장 다운로드 시작...`);

    // 기존 파일 삭제
    for (const f of fs.readdirSync(outDir)) {
      fs.unlinkSync(path.join(outDir, f));
    }

    // 새 파일 저장
    const saved = [];
    for (let i = 0; i < unique.length; i++) {
      const imgUrl = unique[i];
      const ext = imgUrl.includes('.jpg') ? 'jpg' : 'jpg';
      const filename = `photo-${String(i + 1).padStart(2, '0')}.${ext}`;
      const destPath = path.join(outDir, filename);

      try {
        await downloadImage(imgUrl, destPath);
        saved.push(`/presets/${portal.id}/${filename}`);
        process.stdout.write(`     [${i + 1}/${unique.length}] ✅ ${filename}\n`);
      } catch (e) {
        process.stdout.write(`     [${i + 1}/${unique.length}] ❌ 실패\n`);
      }
    }

    // manifest 저장
    const manifest = {
      portalId: portal.id,
      updatedAt: new Date().toISOString(),
      photos: saved,
    };
    fs.writeFileSync(
      path.join(outDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    console.log(`\n  📋 manifest.json 저장 완료 (${saved.length}장)`);
  }

  console.log('\n✅ 완료! public/presets/ 폴더를 확인하세요.');
  console.log('💡 git add public/presets/ 로 커밋하면 Vercel에 자동 포함됩니다.');
}

main().catch(console.error);
