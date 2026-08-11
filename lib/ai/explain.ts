/**
 * Explanation orchestrator (spec §33, §67). Prefers a live AI explanation when
 * configured, with a hard timeout, and ALWAYS falls back to the deterministic
 * templater on any error or when AI is not configured. AI failures never break
 * signal generation — the deterministic path is guaranteed.
 */
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { SignalExplanation } from './types';
import { buildExplanationContext } from './context';
import { explainDeterministic } from './deterministic';
import { explainWithClaude, isAiConfigured } from './claude';

const AI_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), ms)),
  ]);
}

/** Deterministic explanation — instant, no key, no network. */
export function explainSignal(evaluation: EngineEvaluation): SignalExplanation {
  return explainDeterministic(buildExplanationContext(evaluation));
}

/**
 * AI explanation when configured, else deterministic. On-demand only (spec §67):
 * call this from a user-initiated action, not on every render.
 */
export async function explainSignalAI(evaluation: EngineEvaluation): Promise<SignalExplanation> {
  const ctx = buildExplanationContext(evaluation);
  if (!isAiConfigured()) return explainDeterministic(ctx);
  try {
    return await withTimeout(explainWithClaude(ctx), AI_TIMEOUT_MS);
  } catch {
    // Degrade safely — never surface an AI failure as a broken page.
    return explainDeterministic(ctx);
  }
}

export { isAiConfigured };
