import { describe, it, expect, vi, afterEach } from 'vitest';
import { createJob, updateJobSlide, getJob } from '@/lib/jobStore';

afterEach(() => {
  vi.useRealTimers();
});

describe('jobStore', () => {
  it('creates a job pre-filled with null slide placeholders', () => {
    createJob('job-a', 3, 'dark');
    const job = getJob('job-a');
    expect(job).toBeDefined();
    expect(job!.total).toBe(3);
    expect(job!.theme).toBe('dark');
    expect(job!.slides).toEqual([null, null, null]);
  });

  it('returns undefined for an unknown job id', () => {
    expect(getJob('does-not-exist')).toBeUndefined();
  });

  it('updates a single slide by index without disturbing the others', () => {
    createJob('job-b', 3, 't');
    updateJobSlide('job-b', 1, { url: 'https://cdn/slide1.png' });
    const job = getJob('job-b');
    expect(job!.slides).toEqual([null, { url: 'https://cdn/slide1.png' }, null]);
  });

  it('stores per-slide errors', () => {
    createJob('job-c', 2, 't');
    updateJobSlide('job-c', 0, { error: 'render failed' });
    expect(getJob('job-c')!.slides[0]).toEqual({ error: 'render failed' });
  });

  it('silently ignores updates to an unknown job', () => {
    expect(() => updateJobSlide('ghost', 0, { url: 'x' })).not.toThrow();
    expect(getJob('ghost')).toBeUndefined();
  });

  it('evicts jobs older than the 2h expiry window on the next createJob', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T00:00:00Z'));
    createJob('stale', 1, 't');
    expect(getJob('stale')).toBeDefined();

    // Advance just past the 2h TTL, then trigger cleanup via a new createJob.
    vi.setSystemTime(new Date('2026-06-13T02:00:01Z'));
    createJob('fresh', 1, 't');

    expect(getJob('stale')).toBeUndefined();
    expect(getJob('fresh')).toBeDefined();
  });

  it('keeps jobs that are still within the expiry window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T00:00:00Z'));
    createJob('young', 1, 't');

    vi.setSystemTime(new Date('2026-06-13T01:59:59Z'));
    createJob('other', 1, 't');

    expect(getJob('young')).toBeDefined();
  });
});
