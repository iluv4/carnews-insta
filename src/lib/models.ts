// ---------------------------------------------------------------------------
// Model registry + Chat Completions parameter compatibility shim
// ---------------------------------------------------------------------------
// Single source of truth for which OpenAI model each task uses, and the only
// place that knows how the request params differ between model families.
//
// Why this file exists
// --------------------
// Model ids used to be hard-coded per route ('gpt-4.1-mini', 'gpt-4o-mini'),
// which (a) drifted out of sync with the README and the Python agent-service,
// and (b) made it impossible to move the whole app to a newer flagship without
// editing every handler. They are now centralised and env-overridable, so
// cost/quality is a config decision, not a code change.
//
// Defaults track the current OpenAI flagship as of 2026-06: `gpt-5.5`, a
// text+vision multimodal reasoning model. To dial cost/latency back, override
// any of the env vars below (e.g. OPENAI_CLASSIFY_MODEL=gpt-4.1-mini).
//
// The compatibility trap this shim solves
// ----------------------------------------
// GPT-5 / o-series reasoning models are NOT drop-in for the old params:
//   - `temperature` is rejected (400) — must be omitted entirely.
//   - `max_tokens` is deprecated in favour of `max_completion_tokens`.
//   - hidden reasoning tokens are billed against the completion budget, so a
//     tiny cap (e.g. 32) can be fully consumed by reasoning, yielding an empty
//     message. Reasoning models therefore get generous headroom.
// `chatTuning()` emits the correct shape for whichever model id is configured,
// so overriding the env back to a non-reasoning model keeps working unchanged.
// ---------------------------------------------------------------------------

export const MODELS = {
  /** Vision: reads reference card images → structured layout / subject briefs. */
  vision: process.env.OPENAI_VISION_MODEL ?? 'gpt-5.5',
  /** Copywriting / structured text generation. */
  copy: process.env.OPENAI_COPY_MODEL ?? 'gpt-5.5',
  /** Cheap classification (template match) — id-only output. */
  classify: process.env.OPENAI_CLASSIFY_MODEL ?? 'gpt-5.5',
} as const;

type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

// Quality-first default: spend more reasoning (→ more tokens → more cost) on the
// calls that actually drive output quality. gpt-5.5 supports none|low|medium|
// high|xhigh; bump to 'xhigh' (or point a model env at 'gpt-5.5-pro') to go
// further. Non-bottleneck calls (classification, one-shot subject briefs) pass
// 'low' explicitly so we don't pay for reasoning that doesn't move quality.
const DEFAULT_REASONING_EFFORT = (process.env.OPENAI_REASONING_EFFORT ??
  'high') as ReasoningEffort;

/** GPT-5 family and o-series are reasoning models with the param constraints above. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

export type ChatTuning = {
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  reasoning_effort?: ReasoningEffort;
};

/**
 * Build the model-appropriate slice of a Chat Completions request.
 *
 * @param model           the configured model id
 * @param maxOutputTokens desired *visible* output budget
 * @param temperature     desired sampling temperature (ignored for reasoning models)
 * @param reasoningEffort optional effort hint, applied only to reasoning models
 */
export function chatTuning(
  model: string,
  {
    maxOutputTokens,
    temperature,
    reasoningEffort,
  }: { maxOutputTokens: number; temperature?: number; reasoningEffort?: ReasoningEffort }
): ChatTuning {
  if (isReasoningModel(model)) {
    return {
      // Leave room for hidden reasoning tokens on top of the visible output so
      // the JSON/text we actually need is never starved.
      max_completion_tokens: Math.max(maxOutputTokens + 2048, 4096),
      reasoning_effort: reasoningEffort ?? DEFAULT_REASONING_EFFORT,
    };
  }
  const out: ChatTuning = { max_tokens: maxOutputTokens };
  if (temperature !== undefined) out.temperature = temperature;
  return out;
}
