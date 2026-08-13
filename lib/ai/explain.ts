/**
 * Explanation orchestrator. The deterministic templater is always available;
 * configured AI providers only explain verified engine facts on demand.
 */
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { SignalExplanation } from './types';
import { buildExplanationContext } from './context';
import { explainDeterministic } from './deterministic';
import { explainWithClaude, isAiConfigured as isClaudeConfigured } from './claude';
import { explainWithGemini, isGeminiConfigured } from './gemini';

const AI_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), ms)),
  ]);
}

/** Deterministic explanation: instant, no key and no network. */
export function explainSignal(evaluation: EngineEvaluation): SignalExplanation {
  return explainDeterministic(buildExplanationContext(evaluation));
}

export interface AiExplanationResult {
  explanation: SignalExplanation;
  /** Safe user-facing status. It never exposes a provider credential. */
  warning?: string;
}

/** Generate an on-demand explanation without ever altering the market decision. */
export async function explainSignalAIResult(evaluation: EngineEvaluation): Promise<AiExplanationResult> {
  const ctx = buildExplanationContext(evaluation);
  const provider = getAiProvider();
  if (!provider) {
    return { explanation: explainDeterministic(ctx), warning: 'No AI provider is configured.' };
  }

  try {
    const explanation = await withTimeout(
      provider === 'gemini' ? explainWithGemini(ctx) : explainWithClaude(ctx),
      AI_TIMEOUT_MS,
    );
    return { explanation };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown provider error';
    return { explanation: explainDeterministic(ctx), warning: `AI explanation unavailable: ${detail}` };
  }
}

/** Compatibility helper for callers that only need the explanation payload. */
export async function explainSignalAI(evaluation: EngineEvaluation): Promise<SignalExplanation> {
  return (await explainSignalAIResult(evaluation)).explanation;
}

export function getAiProvider(): 'gemini' | 'claude' | null {
  // Prefer Gemini when both keys are present so a migration is predictable.
  if (isGeminiConfigured()) return 'gemini';
  if (isClaudeConfigured() && !process.env.AI_MODEL?.toLowerCase().includes('gemini')) return 'claude';
  return null;
}

export function isAiConfigured(): boolean {
  return getAiProvider() !== null;
}
