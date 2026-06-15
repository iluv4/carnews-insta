import { describe, it, expect } from 'vitest';
import { isReasoningModel, chatTuning } from '@/lib/models';

describe('isReasoningModel', () => {
  it('treats the gpt-5 family as reasoning models', () => {
    expect(isReasoningModel('gpt-5.5')).toBe(true);
    expect(isReasoningModel('gpt-5.5-pro')).toBe(true);
    expect(isReasoningModel('gpt-5')).toBe(true);
  });

  it('treats the o-series as reasoning models', () => {
    expect(isReasoningModel('o1')).toBe(true);
    expect(isReasoningModel('o3-mini')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isReasoningModel('GPT-5.5')).toBe(true);
    expect(isReasoningModel('O3')).toBe(true);
  });

  it('does not flag legacy chat models', () => {
    expect(isReasoningModel('gpt-4o-mini')).toBe(false);
    expect(isReasoningModel('gpt-4.1-mini')).toBe(false);
    expect(isReasoningModel('gpt-3.5-turbo')).toBe(false);
  });
});

describe('chatTuning', () => {
  describe('reasoning models', () => {
    it('omits temperature and max_tokens entirely (they 400 on reasoning models)', () => {
      const t = chatTuning('gpt-5.5', { maxOutputTokens: 500, temperature: 0.7 });
      expect(t.temperature).toBeUndefined();
      expect(t.max_tokens).toBeUndefined();
    });

    it('adds 2048 tokens of headroom for hidden reasoning above the visible budget', () => {
      const t = chatTuning('gpt-5.5', { maxOutputTokens: 4000 });
      // 4000 + 2048 reasoning headroom, comfortably above the 4096 floor
      expect(t.max_completion_tokens).toBe(6048);
    });

    it('floors the completion budget at 4096 for small visible outputs', () => {
      // Math.max(32 + 2048, 4096) and Math.max(500 + 2048, 4096) both floor to 4096.
      expect(chatTuning('gpt-5.5', { maxOutputTokens: 32 }).max_completion_tokens).toBe(4096);
      expect(chatTuning('gpt-5.5', { maxOutputTokens: 500 }).max_completion_tokens).toBe(4096);
    });

    it('applies the default reasoning effort when none is passed', () => {
      const t = chatTuning('gpt-5.5', { maxOutputTokens: 500 });
      expect(t.reasoning_effort).toBe('high');
    });

    it('respects an explicit reasoning effort hint', () => {
      const t = chatTuning('gpt-5.5', { maxOutputTokens: 500, reasoningEffort: 'low' });
      expect(t.reasoning_effort).toBe('low');
    });
  });

  describe('legacy chat models', () => {
    it('uses max_tokens and forwards temperature', () => {
      const t = chatTuning('gpt-4o-mini', { maxOutputTokens: 256, temperature: 0.3 });
      expect(t.max_tokens).toBe(256);
      expect(t.temperature).toBe(0.3);
      expect(t.max_completion_tokens).toBeUndefined();
      expect(t.reasoning_effort).toBeUndefined();
    });

    it('omits temperature when not provided rather than sending undefined', () => {
      const t = chatTuning('gpt-4o-mini', { maxOutputTokens: 256 });
      expect(t.max_tokens).toBe(256);
      expect('temperature' in t).toBe(false);
    });
  });
});
