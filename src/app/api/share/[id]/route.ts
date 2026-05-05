import { NextResponse } from 'next/server';
import { getJob } from '@/lib/jobStore';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  const done = job.slides.every(s => s !== null);
  return NextResponse.json({ slides: job.slides, done, theme: job.theme, total: job.total });
}
