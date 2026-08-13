'use server';

/**
 * Server action for on-demand AI explanations (spec §67 cost control — generated
 * only when the user asks, never on every render). Runs server-side so the AI key
 * is never exposed; falls back to the deterministic explainer on any failure.
 */
import { getMarketDetail } from '@/lib/market/source';
import { explainSignalAIResult, type AiExplanationResult } from '@/lib/ai/explain';
import { persistSignal, type PersistResult } from '@/lib/supabase/repositories/signals';

export async function generateAiExplanation(symbol: string): Promise<AiExplanationResult | null> {
  const detail = await getMarketDetail(symbol);
  if (!detail) return null;
  return explainSignalAIResult(detail.evaluation);
}

/** Persist the current read to signal history (spec §27). Requires Supabase +
 * an authenticated user; returns a structured result the client renders. */
export async function saveSignalToHistory(symbol: string): Promise<PersistResult> {
  const detail = await getMarketDetail(symbol);
  if (!detail) return { error: 'Signal not found.' };
  return persistSignal(detail.evaluation);
}
