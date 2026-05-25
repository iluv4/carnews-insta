import { Redis } from '@upstash/redis';

export type SlideResult = { url: string } | { error: string } | null;

interface Job {
  slides: SlideResult[];
  total: number;
  theme: string;
  createdAt: number;
}

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const EXPIRY_S = EXPIRY_MS / 1000;

// ── Upstash Redis backing, with in-memory fallback ───────────────────────────
// Vercel functions are stateless and multi-worker, so an in-memory Map loses
// jobs across requests/restarts. When UPSTASH_REDIS_REST_URL/TOKEN are set,
// jobs persist in Upstash Redis (HTTP, edge-friendly). Without them (local dev)
// we transparently fall back to memory.
const hasRedisEnv = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasRedisEnv ? Redis.fromEnv() : null;

const memJobs = new Map<string, Job>();
const key = (id: string) => `job:${id}`;

export async function createJob(id: string, total: number, theme: string): Promise<void> {
  const job: Job = { slides: Array(total).fill(null), total, theme, createdAt: Date.now() };
  if (redis) {
    await redis.set(key(id), job, { ex: EXPIRY_S });
    return;
  }
  cleanupMem();
  memJobs.set(id, job);
}

export async function updateJobSlide(id: string, index: number, result: NonNullable<SlideResult>): Promise<void> {
  if (redis) {
    const job = await getJob(id);
    if (!job) return;
    job.slides[index] = result;
    await redis.set(key(id), job, { ex: EXPIRY_S });
    return;
  }
  const job = memJobs.get(id);
  if (job) job.slides[index] = result;
}

export async function getJob(id: string): Promise<Job | undefined> {
  if (redis) {
    // @upstash/redis auto-deserializes JSON values stored via set().
    const job = await redis.get<Job>(key(id));
    return job ?? undefined;
  }
  return memJobs.get(id);
}

function cleanupMem() {
  const now = Date.now();
  for (const [id, job] of memJobs) {
    if (now - job.createdAt > EXPIRY_MS) memJobs.delete(id);
  }
}
