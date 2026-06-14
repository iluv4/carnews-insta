import { describe, it, expect } from 'vitest';
import { isReasoningModel, chatTuning } from '@/lib/models';

describe('isReasoningModel', () => {
  it('treats the gpt-5 family as reasoning models', () => {
    expect(isReasoningModel('gpt-5.5')).toBe(true);
    expect(isReasoningModel('gpt-5')).toBe(true);
    expect(isReasoningModel('gpt-5.5-pro')).toBe(true);
    expect(isReasoningModel('GPT-5.5')).toBe(true); // case-insensitive
  });

  it('treats the o-series as reasoning models', () => {
    expect(isReasoningModel('o1')).toBe(true);
    expect(isReasoningModel('o3-mini')).toBe(true);
  });

  it('does NOT treat gpt-4 family (including gpt-4o) as reasoning models', () => {
    expect(isReasoningModel('gpt-4.1-mini')).toBe(false);
    expect(isReasoningModel('gpt-4o-mini')).toBe(false);
    expect(isReasoningModel('gpt-4o')).toBe(false);
  });
});

describe('chatTuning', () => {
  it('omits temperature and uses max_completion_tokens for reasoning models', () => {
    const t = chatTuning('gpt-5.5', { maxOutputTokens: 256, temperature: 0.7, reasoningEffort: 'low' });
    expect(t.temperature).toBeUndefined();
    expect(t.max_tokens).toBeUndefined();
    expect(t.reasoning_effort).toBe('low');
    // generous headroom so hidden reasoning tokens never starve the visible output
    expect(t.max_completion_tokens).toBeGreaterThanOrEqual(256 + 2048);
  });

  it('guarantees a minimum completion budget for reasoning models', () => {
    const t = chatTuning('o3', { maxOutputTokens: 1 });
    expect(t.max_completion_tokens).toBeGreaterThanOrEqual(4096);
  });

  it('uses max_tokens + temperature for non-reasoning models', () => {
    const t = chatTuning('gpt-4o-mini', { maxOutputTokens: 100, temperature: 0.3 });
    expect(t.max_tokens).toBe(100);
    expect(t.temperature).toBe(0.3);
    expect(t.max_completion_tokens).toBeUndefined();
    expect(t.reasoning_effort).toBeUndefined();
  });

  it('omits temperature for non-reasoning models when not provided', () => {
    const t = chatTuning('gpt-4o-mini', { maxOutputTokens: 100 });
    expect(t.max_tokens).toBe(100);
    expect('temperature' in t).toBe(false);
  });
});
