/**
 * scripts/batch-analyze-refs.mjs
 * saved-refs 41장을 일괄 분석해 Reference + LayoutAnalysis + Template DB에 저장합니다.
 *
 * 실행: node scripts/batch-analyze-refs.mjs
 * (dev 서버가 실행 중이어야 합니다: npm run dev)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Load saved refs index
const indexPath = path.join(__dirname, '../src/templates/index.json');
if (!fs.existsSync(indexPath)) {
  console.error('❌ src/templates/index.json not found. Run npm run presets:download first.');
  process.exit(1);
}

const templates = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
console.log(`📦 Found ${templates.length} saved references\n`);

let processed = 0, failed = 0;

for (const tpl of templates) {
  const sourceUrl = tpl.source;
  if (!sourceUrl) { console.log(`⏩ Skip (no source): ${tpl.name}`); continue; }

  process.stdout.write(`🔄 [${processed + 1}/${templates.length}] ${tpl.name} ... `);

  try {
    // 1) Create Reference from instagram URL
    const refRes = await fetch(`${BASE_URL}/api/references/from-instagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
    });

    if (!refRes.ok) {
      const err = await refRes.json().catch(() => ({}));
      console.log(`❌ ref failed: ${err.error || refRes.statusText}`);
      failed++;
      continue;
    }

    const { referenceId } = await refRes.json();

    // 2) Analyze the reference → LayoutAnalysis
    const analysisRes = await fetch(`${BASE_URL}/api/references/${referenceId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!analysisRes.ok) {
      const err = await analysisRes.json().catch(() => ({}));
      console.log(`❌ analyze failed: ${err.error || analysisRes.statusText}`);
      failed++;
      continue;
    }

    const { analysisId } = await analysisRes.json();

    // 3) Save as Template
    const tmplRes = await fetch(`${BASE_URL}/api/templates/from-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisId,
        name: tpl.name || `[저장] ${sourceUrl}`,
        category: tpl.category || null,
        tags: tpl.tags ? { industry: Array.isArray(tpl.tags) ? tpl.tags : [] } : undefined,
      }),
    });

    if (!tmplRes.ok) {
      const err = await tmplRes.json().catch(() => ({}));
      console.log(`❌ template save failed: ${err.error || tmplRes.statusText}`);
      failed++;
      continue;
    }

    const { templateId } = await tmplRes.json();
    console.log(`✅ templateId=${templateId}`);
    processed++;

    // Rate limit: 2s between requests to avoid OpenAI quota
    await new Promise(r => setTimeout(r, 2000));

  } catch (e) {
    console.log(`❌ error: ${e.message}`);
    failed++;
  }
}

console.log(`\n📊 Done: ${processed} succeeded, ${failed} failed`);
