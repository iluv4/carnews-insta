/**
 * Upstage Universal Information Extraction 검증 스크립트.
 *
 * 빌드 환경에서 콘솔 문서(봇 차단)와 실키 검증이 불가능했으므로, 실제
 * UPSTAGE_API_KEY 로 sync/async 엔드포인트 동작을 확인하는 용도다.
 *
 * 사용법:
 *   UPSTAGE_API_KEY=... node scripts/upstage-extract.mjs <file> [async|sync]
 *
 * 예:
 *   UPSTAGE_API_KEY=up_... node scripts/upstage-extract.mjs ./spec.pdf async
 *
 * 엔드포인트가 다르면 UPSTAGE_IE_URL / UPSTAGE_IE_ASYNC_URL /
 * UPSTAGE_IE_REQUESTS_URL / UPSTAGE_SCHEMA_GEN_URL 로 덮어쓸 수 있다.
 */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const IE_BASE = process.env.UPSTAGE_IE_URL ?? 'https://api.upstage.ai/v1/information-extraction';
const IE_ASYNC_URL = process.env.UPSTAGE_IE_ASYNC_URL ?? `${IE_BASE}/async`;
const IE_REQUESTS_URL = process.env.UPSTAGE_IE_REQUESTS_URL ?? `${IE_BASE}/requests`;
const SCHEMA_GEN_URL = process.env.UPSTAGE_SCHEMA_GEN_URL ?? `${IE_BASE}/schema-generation`;
const IE_MODEL = process.env.UPSTAGE_IE_MODEL ?? 'information-extract';

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.bmp': 'image/bmp',
  '.tiff': 'image/tiff', '.tif': 'image/tiff', '.heic': 'image/heic', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const [, , filePath, mode = 'async'] = process.argv;
const KEY = process.env.UPSTAGE_API_KEY;

if (!KEY) { console.error('UPSTAGE_API_KEY 환경변수가 필요합니다.'); process.exit(1); }
if (!filePath) { console.error('사용법: node scripts/upstage-extract.mjs <file> [async|sync]'); process.exit(1); }

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext];
  if (!mime) { console.error(`지원하지 않는 형식: ${ext}`); process.exit(1); }

  const base64 = (await readFile(filePath)).toString('base64');
  const messages = [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }] }];

  console.error(`[1/3] schema-generation … (${basename(filePath)})`);
  const sg = await fetch(SCHEMA_GEN_URL, { method: 'POST', headers, body: JSON.stringify({ model: IE_MODEL, messages }) });
  if (!sg.ok) { console.error(`schema-generation 실패: ${sg.status}\n${await sg.text()}`); process.exit(1); }
  const sgJson = await sg.json();
  const content = sgJson?.choices?.[0]?.message?.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content ?? sgJson;
  const schema = parsed.json_schema ?? parsed.schema ?? parsed;
  console.error('      스키마 생성 완료.');

  const body = JSON.stringify({ model: IE_MODEL, messages, response_format: { type: 'json_schema', json_schema: schema } });

  let result;
  if (mode === 'sync') {
    console.error('[2/3] 동기 추출 …');
    const r = await fetch(IE_BASE, { method: 'POST', headers, body });
    if (!r.ok) { console.error(`추출 실패: ${r.status}\n${await r.text()}`); process.exit(1); }
    result = await r.json();
  } else {
    console.error('[2/3] async 제출 …');
    const sub = await fetch(IE_ASYNC_URL, { method: 'POST', headers, body });
    if (!sub.ok) { console.error(`async 제출 실패: ${sub.status}\n${await sub.text()}`); process.exit(1); }
    const { request_id } = await sub.json();
    console.error(`      request_id=${request_id} — 폴링 …`);
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      await sleep(2000);
      const p = await fetch(`${IE_REQUESTS_URL}/${request_id}`, { headers: { Authorization: `Bearer ${KEY}` } });
      if (!p.ok) { console.error(`폴링 실패: ${p.status}\n${await p.text()}`); process.exit(1); }
      result = await p.json();
      const status = String(result.status ?? '').toLowerCase();
      console.error(`      status=${status || '(none)'}`);
      if (['completed', 'succeeded', 'success', 'done'].includes(status) || (!status && result.choices)) break;
      if (['failed', 'error', 'expired', 'cancelled', 'canceled'].includes(status)) {
        console.error(`async 실패: ${JSON.stringify(result)}`); process.exit(1);
      }
    }
  }

  console.error('[3/3] 결과:');
  const out = result?.choices?.[0]?.message?.content ?? result;
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
