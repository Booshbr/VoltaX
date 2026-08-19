/**
 * Walk-forward parameter optimizer (spec §9, §15, §61). Proposes — never adopts —
 * a better StrategyConfig, with honest anti-overfit evidence:
 *   1. Split each market's timeline into an older IN-SAMPLE window and a newer
 *      OUT-OF-SAMPLE window.
 *   2. For each candidate parameter value, backtest the SAME engine across the
 *      whole universe and partition the resulting trades by the split time.
 *   3. Pick the best candidate ON IN-SAMPLE data, then only RECOMMEND it if it also
 *      beats the current baseline ON OUT-OF-SAMPLE data (data it was not chosen on).
 *
 * A change is a proposal only: adoption is a deliberate, human-approved, versioned
 * code change (bump METHODOLOGY_VERSION) — this module never edits the live engine.
 */
import { runBacktest, type BacktestTrade } from './backtest';
import { DEFAULT_STRATEGY, type StrategyConfig } from '@/lib/config/strategy';
import type { Candle, Instrument, Timeframe } from '@/lib/types';

export interface UniverseSeries {
  instrument: Instrument;
  candles: Partial<Record<Timeframe, Candle[]>>;
}

export interface OptimizerInput {
  universe: UniverseSeries[];
  /** Candidate `minimumRiskReward` values to test. */
  riskRewardGrid?: number[];
  /** Fraction of the timeline used for in-sample training (rest is out-of-sample). */
  trainFraction?: number;
  decisionTimeframe?: Timeframe;
  baseConfig?: StrategyConfig;
  /** Minimum trades in a window before its stats are trusted / eligible. */
  minTrades?: number;
}

export interface WindowStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectancyR: number;
}

export interface CandidateResult {
  minimumRiskReward: number;
  inSample: WindowStats;
  outOfSample: WindowStats;
}

export interface OptimizerReport {
  baseline: CandidateResult;
  candidates: CandidateResult[];
  /** The candidate that won in-sample AND generalised out-of-sample, or null. */
  recommended: CandidateResult | null;
  meta: { symbols: number; trainFraction: number; minTrades: number; splitTime: number };
}

export function statsFor(trades: BacktestTrade[]): WindowStats {
  const wins = trades.filter((t) => t.result === 'win').length;
  const losses = trades.length - wins;
  return {
    trades: trades.length,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length : null,
    expectancyR: trades.length ? trades.reduce((a, t) => a + t.rMultiple, 0) / trades.length : 0,
  };
}

/** Global split time = trainFraction of the way through the decision-timeframe span. */
export function splitTimeFor(universe: UniverseSeries[], decisionTf: Timeframe, trainFraction: number): number {
  let min = Infinity;
  let max = -Infinity;
  for (const u of universe) {
    const d = u.candles[decisionTf] ?? [];
    if (d.length) {
      min = Math.min(min, d[0]!.time);
      max = Math.max(max, d[d.length - 1]!.time);
    }
  }
  if (!Number.isFinite(min)) return 0;
  return min + trainFraction * (max - min);
}

function evaluateCandidate(
  universe: UniverseSeries[],
  minimumRiskReward: number,
  baseConfig: StrategyConfig,
  decisionTf: Timeframe,
  splitTime: number,
): CandidateResult {
  const config: StrategyConfig = { ...baseConfig, minimumRiskReward };
  const inSample: BacktestTrade[] = [];
  const outOfSample: BacktestTrade[] = [];
  for (const u of universe) {
    const bt = runBacktest({ instrument: u.instrument, candles: u.candles, config, decisionTimeframe: decisionTf, warmup: 30 });
    for (const t of bt.trades) (t.entryTime <= splitTime ? inSample : outOfSample).push(t);
  }
  return { minimumRiskReward, inSample: statsFor(inSample), outOfSample: statsFor(outOfSample) };
}

/**
 * Pure walk-forward selection: best in-sample among eligible candidates, recommended
 * only if it changes the baseline AND beats it out-of-sample with enough OOS trades.
 * Exported for direct unit testing of the anti-overfit guard.
 */
export function pickRecommendation(
  baseline: CandidateResult,
  candidates: CandidateResult[],
  minTrades: number,
): CandidateResult | null {
  const bestInSample = candidates
    .filter((c) => c.inSample.trades >= minTrades)
    .sort((a, b) => b.inSample.expectancyR - a.inSample.expectancyR)[0];
  if (!bestInSample) return null;
  const generalises =
    bestInSample.minimumRiskReward !== baseline.minimumRiskReward &&
    bestInSample.outOfSample.trades >= minTrades &&
    bestInSample.outOfSample.expectancyR > baseline.outOfSample.expectancyR;
  return generalises ? bestInSample : null;
}

export function walkForwardOptimize(input: OptimizerInput): OptimizerReport {
  const baseConfig = input.baseConfig ?? DEFAULT_STRATEGY;
  const decisionTf = input.decisionTimeframe ?? '5m';
  const trainFraction = input.trainFraction ?? 0.7;
  const minTrades = input.minTrades ?? 20;
  const grid = input.riskRewardGrid ?? [1.6, 1.8, 2.0, 2.2, 2.5];
  const splitTime = splitTimeFor(input.universe, decisionTf, trainFraction);

  const candidates = grid.map((rr) => evaluateCandidate(input.universe, rr, baseConfig, decisionTf, splitTime));
  const baseline =
    candidates.find((c) => c.minimumRiskReward === baseConfig.minimumRiskReward) ??
    evaluateCandidate(input.universe, baseConfig.minimumRiskReward, baseConfig, decisionTf, splitTime);

  return {
    baseline,
    candidates,
    recommended: pickRecommendation(baseline, candidates, minTrades),
    meta: { symbols: input.universe.length, trainFraction, minTrades, splitTime },
  };
}
