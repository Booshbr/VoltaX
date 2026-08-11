/**
 * Versioned strategy configuration (spec §34, §35, §61).
 * Strategy parameters live here (and, in production, in the `strategy_versions`
 * table) — never scattered as magic numbers across the codebase. Every signal
 * references the methodology version that produced it so backtests stay meaningful.
 */

/** Current methodology version. Bump on any change to decision logic (spec §34). */
export const METHODOLOGY_VERSION = 'VOLTAX-METHOD-1.0.0';

/** Weights that compose the opportunity ranking score (spec §13). Must sum to 1. */
export interface ScoringWeights {
  structure: number;
  setup: number;
  entry: number;
  reliability: number;
  riskReward: number;
  marketCondition: number;
}

export interface StrategyConfig {
  version: string;
  /** Minimum statistical reliability (0..100) to qualify a signal (spec §61). */
  minimumReliability: number;
  /** Minimum reward-to-risk ratio to qualify a signal (spec §20). */
  minimumRiskReward: number;
  /** Composite opportunity score (0..100) required to surface as an opportunity. */
  minimumOpportunityScore: number;
  /** Feed staleness (ms) beyond which NO new signals are generated (spec §39, §40). */
  maxFeedStalenessMs: number;
  scoringWeights: ScoringWeights;
  risk: RiskConfig;
}

/** Risk framework defaults — deliberately conservative (spec §20). */
export interface RiskConfig {
  /** Per-trade risk as a fraction of equity (0.01 = 1%). */
  perTradeRisk: number;
  /** Maximum cumulative risk per day as a fraction of equity. */
  maxDailyRisk: number;
  /** Maximum simultaneous open risk as a fraction of equity. */
  maxOpenRisk: number;
  /** Halt new trades after this many consecutive losses. */
  maxConsecutiveLosses: number;
  /** Maximum open positions at once. */
  maxOpenTrades: number;
  /** No martingale, no auto position-doubling — enforced structurally (spec §20). */
  allowMartingale: false;
}

/**
 * The default, empirically-tunable baseline. Thresholds here are conservative
 * starting points, NOT claimed as statistically optimal (spec §61) — they are
 * meant to be validated by the backtesting engine and versioned when changed.
 */
export const DEFAULT_STRATEGY: StrategyConfig = {
  version: METHODOLOGY_VERSION,
  // reliabilityScore is the conservative (Wilson lower-bound) estimate of the
  // historical TP1-hit rate. At the ~2:1 R:R this engine targets, breakeven is a
  // ~33% hit rate, so a conservative estimate of ~45 already implies solidly
  // positive expectancy. Tunable + versioned; validated by backtests (spec §61).
  minimumReliability: 45,
  minimumRiskReward: 1.8,
  minimumOpportunityScore: 60,
  maxFeedStalenessMs: 15_000,
  scoringWeights: {
    structure: 0.25,
    setup: 0.22,
    entry: 0.18,
    reliability: 0.2,
    riskReward: 0.1,
    marketCondition: 0.05,
  },
  risk: {
    perTradeRisk: 0.01,
    maxDailyRisk: 0.03,
    maxOpenRisk: 0.04,
    maxConsecutiveLosses: 4,
    maxOpenTrades: 3,
    allowMartingale: false,
  },
};

/** Runtime guard: scoring weights must sum to ~1 (defensive against config drift). */
export function assertValidWeights(w: ScoringWeights): void {
  const sum =
    w.structure + w.setup + w.entry + w.reliability + w.riskReward + w.marketCondition;
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error(`ScoringWeights must sum to 1, got ${sum}`);
  }
}
