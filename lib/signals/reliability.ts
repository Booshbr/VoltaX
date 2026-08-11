/**
 * Statistical reliability (spec §14). Reliability is DERIVED FROM A HISTORICAL
 * SAMPLE, never from "several indicators agree". With a small or empty sample we
 * shrink toward a neutral prior and flag insufficiency — we never overstate
 * confidence (spec §2, §76). Uses the Wilson score lower bound, which naturally
 * penalises small samples.
 */

export interface PerformanceSample {
  wins: number;
  losses: number;
}

export interface ReliabilityResult {
  /** 0..100 reliability score. NOT a probability of future profit (spec §13). */
  score: number;
  sampleSize: number;
  winRate: number | null;
  /** True once the sample is large enough to be statistically meaningful. */
  sufficient: boolean;
}

const MIN_SUFFICIENT_SAMPLE = 20;

/**
 * Wilson score interval lower bound at ~95% confidence. Returns a conservative
 * estimate of the true win rate given observed wins/losses.
 */
export function wilsonLowerBound(wins: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const phat = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

export function computeReliability(sample: PerformanceSample): ReliabilityResult {
  const n = sample.wins + sample.losses;
  if (n === 0) {
    // No evidence: neutral prior, explicitly insufficient.
    return { score: 50, sampleSize: 0, winRate: null, sufficient: false };
  }
  const winRate = sample.wins / n;
  const lower = wilsonLowerBound(sample.wins, n);
  // Blend the conservative lower bound with the point estimate, weighting toward
  // the lower bound so small samples score cautiously.
  const blended = lower * 0.7 + winRate * 0.3;
  return {
    score: Math.round(blended * 100),
    sampleSize: n,
    winRate,
    sufficient: n >= MIN_SUFFICIENT_SAMPLE,
  };
}
