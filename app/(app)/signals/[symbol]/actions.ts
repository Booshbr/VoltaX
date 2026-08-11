'use server';

/**
 * Server action for on-demand AI explanations (spec §67 cost control — generated
 * only when the user asks, never on every render). Runs server-side so the AI key
 * is never exposed; falls back to the deterministic explainer on any failure.
 */
import { getMarketDetail } from '@/lib/market/source';
import { explainSignalAI } from '@/lib/ai/explain';
import type { SignalExplanation } from '@/lib/ai/types';

export async function generateAiExplanation(symbol: string): Promise<SignalExplanation | null> {
  const detail = await getMarketDetail(symbol);
  if (!detail) return null;
  return explainSignalAI(detail.evaluation);
}
