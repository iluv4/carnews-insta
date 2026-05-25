export type SlideResult = { url: string } | { error: string } | null;

interface Job {
  slides: SlideResult[];
  total: number;
  theme: string;
  createdAt: number;
}

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const EXPIRY_S = EXPIRY_MS / 1000;

// ── Upstash Redis (REST) backing, with in-memory fallback ────────────────────
// Vercel serverless functions are stateless and can run on many workers, so an
// in-memory Map loses jobs across requests/restarts. When UPSTASH_REDIS_REST_*
// is configured, jobs are persisted in Redis (works over HTTP, no socket).
// Without it (local dev / no account yet), we transparently fall back to memory.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

const memJobs = new Map<string, Job>();
const key = (id: string) => `job:${id}`;

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result;
}

export async function createJob(id: string, total: number, theme: string): Promise<void> {
  const job: Job = { slides: Array(total).fill(null), total, theme, createdAt: Date.now() };
  if (useRedis) {
    await redis(['SET', key(id), JSON.stringify(job), 'EX', EXPIRY_S]);
    return;
  }
  cleanupMem();
  memJobs.set(id, job);
}

export async function updateJobSlide(id: string, index: number, result: NonNullable<SlideResult>): Promise<void> {
  if (useRedis) {
    const job = await getJob(id);
    if (!job) return;
    job.slides[index] = result;
    await redis(['SET', key(id), JSON.stringify(job), 'EX', EXPIRY_S]);
    return;
  }
  const job = memJobs.get(id);
  if (job) job.slides[index] = result;
}

export async function getJob(id: string): Promise<Job | undefined> {
  if (useRedis) {
    const raw = (await redis(['GET', key(id)])) as string | null;
    return raw ? (JSON.parse(raw) as Job) : undefined;
  }
  return memJobs.get(id);
}

function cleanupMem() {
  const now = Date.now();
  for (const [id, job] of memJobs) {
    if (now - job.createdAt > EXPIRY_MS) memJobs.delete(id);
  }
}
