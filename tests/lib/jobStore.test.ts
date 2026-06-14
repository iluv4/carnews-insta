import { describe, it, expect } from 'vitest';
import { createJob, updateJobSlide, getJob } from '@/lib/jobStore';

describe('jobStore', () => {
  it('creates a job pre-filled with null slides', () => {
    createJob('job-1', 3, 'cars');
    const job = getJob('job-1');
    expect(job).toBeDefined();
    expect(job!.total).toBe(3);
    expect(job!.theme).toBe('cars');
    expect(job!.slides).toEqual([null, null, null]);
  });

  it('updates a slide by index', () => {
    createJob('job-2', 2, 'food');
    updateJobSlide('job-2', 1, { url: 'https://img/x.png' });
    const job = getJob('job-2');
    expect(job!.slides[0]).toBeNull();
    expect(job!.slides[1]).toEqual({ url: 'https://img/x.png' });
  });

  it('stores error results too', () => {
    createJob('job-3', 1, 't');
    updateJobSlide('job-3', 0, { error: 'boom' });
    expect(getJob('job-3')!.slides[0]).toEqual({ error: 'boom' });
  });

  it('ignores updates to unknown jobs without throwing', () => {
    expect(() => updateJobSlide('missing', 0, { url: 'x' })).not.toThrow();
    expect(getJob('missing')).toBeUndefined();
  });
});
