export type SlideResult = { url: string } | { error: string } | null;

interface Job {
  slides: SlideResult[];
  total: number;
  theme: string;
  createdAt: number;
}

// In-memory store — survives the request, lost on server restart (fine for local/single-process)
const jobs = new Map<string, Job>();
const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

export function createJob(id: string, total: number, theme: string) {
  cleanup();
  jobs.set(id, { slides: Array(total).fill(null), total, theme, createdAt: Date.now() });
}

export function updateJobSlide(id: string, index: number, result: NonNullable<SlideResult>) {
  const job = jobs.get(id);
  if (job) job.slides[index] = result;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > EXPIRY_MS) jobs.delete(id);
  }
}
