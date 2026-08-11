/**
 * Opportunity scoring (spec §13). A standardized 0..100 ranking score composed
 * from the six weighted components. This is a RANKING score, not a probability of
 * profit (spec §13 "Do not present the score as a probability of profit unless
 * statistically calibrated").
 */
import type { ScoringWeights } from '@/lib/config/strategy';
import { assertValidWeights } from '@/lib/config/strategy';

export interface ScoreComponents {
  /** All inputs are 0..1. */
  structureQuality: number;
  setupQuality: number;
  entryQuality: number;
  reliability: number; // 0..1 (reliabilityScore/100)
  riskRewardQuality: number;
  marketCompatibility: number;
}

/** Map a raw R:R to a 0..1 quality via a soft cap around a target of ~3:1. */
export function riskRewardQuality(rr: number, target = 3): number {
  if (rr <= 0) return 0;
  return Math.max(0, Math.min(1, rr / target));
}

/** Weighted composite → 0..100. */
export function opportunityScore(
  c: ScoreComponents,
  weights: ScoringWeights,
): number {
  assertValidWeights(weights);
  const composite =
    c.structureQuality * weights.structure +
    c.setupQuality * weights.setup +
    c.entryQuality * weights.entry +
    c.reliability * weights.reliability +
    c.riskRewardQuality * weights.riskReward +
    c.marketCompatibility * weights.marketCondition;
  return Math.round(Math.max(0, Math.min(1, composite)) * 100);
}
