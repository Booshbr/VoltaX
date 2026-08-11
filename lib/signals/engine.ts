/**
 * Strategy engine (spec §5, §62). The SINGLE deterministic decision core shared by
 * live signal generation, paper trading and backtesting — there is no second
 * implementation that could drift. It composes the modes strictly:
 *
 *   feed freshness → HTF structure → setup(15M) → entry(5M) → precision(1M)
 *   → risk validation → statistical qualification → SIGNAL
 *
 * "No qualified setup" is a first-class, valid result (spec §60). The engine never
 * manufactures a signal to keep the dashboard busy.
 */
import type {
  Bias,
  Candle,
  Direction,
  DataQualityStatus,
  EntryAnalysis,
  Instrument,
  MarketStructureAnalysis,
  PrecisionAnalysis,
  RiskCalculation,
  SetupAnalysis,
  Signal,
  SignalReason,
  SignalStatus,
  TakeProfit,
  Timeframe,
} from '@/lib/types';
import { DEFAULT_STRATEGY, type StrategyConfig } from '@/lib/config/strategy';
import { getFamilyProfile } from '@/lib/config/families';
import { analyzeStructure } from '@/lib/analytics/structure';
import { analyzeSetup } from '@/lib/analytics/setup';
import { analyzeEntry, analyzePrecision } from '@/lib/analytics/entry';
import { latestAtr } from '@/lib/analytics/volatility';
import { calculatePosition } from '@/lib/trading/risk';
import { feedAllowsSignals } from '@/lib/market-data/quality';
import {
  computeReliability,
  type PerformanceSample,
  type ReliabilityResult,
} from './reliability';
import { opportunityScore, riskRewardQuality } from './scoring';

export interface EngineInput {
  instrument: Instrument;
  /** Candles per timeframe; each ascending by time, already validated. */
  candles: Partial<Record<Timeframe, Candle[]>>;
  accountEquity: number;
  feed: DataQualityStatus;
  /** Evaluation time (Unix seconds). */
  now: number;
  config?: StrategyConfig;
  /** Historical performance of comparable setups — drives reliability (spec §14). */
  sample?: PerformanceSample;
  idFactory?: () => string;
  nowIso?: () => string;
}

/** Full, always-populated evaluation used both to rank and to qualify signals. */
export interface EngineEvaluation {
  instrumentSymbol: string;
  family: Instrument['family'];
  direction: Direction | null;
  status: SignalStatus;
  qualified: boolean;
  /** Latest known price for marking positions to market (last available close). */
  lastPrice: number | null;
  opportunityScore: number;
  reliability: ReliabilityResult;
  riskReward: number;
  htf: MarketStructureAnalysis;
  mtf: MarketStructureAnalysis;
  setup: SetupAnalysis;
  entry: EntryAnalysis;
  precision: PrecisionAnalysis;
  risk: RiskCalculation | null;
  reasons: SignalReason[];
  rejectionReason: string | null;
  signal: Signal | null;
  methodologyVersion: string;
  evaluatedAt: string;
}

const biasToDir = (b: Bias): Direction | null =>
  b === 'bullish' ? 'long' : b === 'bearish' ? 'short' : null;

function marketCompatibility(htf: MarketStructureAnalysis): number {
  if (htf.volatility === 'abnormal') return 0.2;
  if (htf.regime === 'trending') return 1;
  if (htf.regime === 'ranging') return 0.5;
  return 0.35;
}

/** Derive entry/stop/TPs for a direction, guarding side correctness. */
function buildLevels(
  direction: Direction,
  entry: number,
  refinedStop: number | null,
  invalidation: number | null,
  atr: number,
): { stop: number; takeProfits: TakeProfit[] } {
  const fallback = atr > 0 ? atr : entry * 0.001;
  let stop: number;
  if (direction === 'long') {
    const candidates = [refinedStop, invalidation, entry - fallback].filter(
      (v): v is number => v !== null && v < entry,
    );
    stop = candidates.length ? Math.max(...candidates) : entry - fallback;
  } else {
    const candidates = [refinedStop, invalidation, entry + fallback].filter(
      (v): v is number => v !== null && v > entry,
    );
    stop = candidates.length ? Math.min(...candidates) : entry + fallback;
  }
  const r = Math.abs(entry - stop);
  const sign = direction === 'long' ? 1 : -1;
  const takeProfits: TakeProfit[] = [
    { level: 1, price: entry + sign * r * 2 },
    { level: 2, price: entry + sign * r * 3 },
  ];
  return { stop, takeProfits };
}

/**
 * Evaluate one instrument. Always returns a full evaluation; `qualified` and
 * `signal` are only set when every mandatory gate passes.
 */
export function evaluate(input: EngineInput): EngineEvaluation {
  const config = input.config ?? DEFAULT_STRATEGY;
  const profile = getFamilyProfile(input.instrument.family);
  const nowIso = input.nowIso ?? (() => new Date(input.now * 1000).toISOString());
  const evaluatedAt = nowIso();

  const c4 = input.candles['4h'] ?? [];
  const c1 = input.candles['1h'] ?? [];
  const c15 = input.candles['15m'] ?? [];
  const c5 = input.candles['5m'] ?? [];
  const c1m = input.candles['1m'] ?? [];

  const structOpts = {
    abnormalMultiple: profile.volatilityModel.abnormalMoveAtr,
    structureBias: profile.structureBias,
  };
  const htf = analyzeStructure(c4, '4h', structOpts);
  const mtf = analyzeStructure(c1, '1h', structOpts);

  const reasons: SignalReason[] = [];
  const reliability = computeReliability(input.sample ?? { wins: 0, losses: 0 });

  // Latest known price for marking positions (finest timeframe available).
  const lastPrice =
    c1m[c1m.length - 1]?.close ??
    c5[c5.length - 1]?.close ??
    c15[c15.length - 1]?.close ??
    c1[c1.length - 1]?.close ??
    c4[c4.length - 1]?.close ??
    null;

  // Empty shells for early returns.
  const emptySetup = analyzeSetup(c15, 'neutral');
  const emptyEntry = analyzeEntry(c5, null);
  const emptyPrecision = analyzePrecision(c1m, null);

  const baseEval = (
    over: Partial<EngineEvaluation> & { status: SignalStatus; rejectionReason: string | null },
  ): EngineEvaluation => ({
    instrumentSymbol: input.instrument.symbol,
    family: input.instrument.family,
    direction: null,
    qualified: false,
    lastPrice,
    opportunityScore: 0,
    reliability,
    riskReward: 0,
    htf,
    mtf,
    setup: emptySetup,
    entry: emptyEntry,
    precision: emptyPrecision,
    risk: null,
    reasons,
    signal: null,
    methodologyVersion: config.version,
    evaluatedAt,
    ...over,
  });

  // Gate 0 — feed freshness. Never generate signals on stale data (spec §39).
  if (!feedAllowsSignals(input.feed)) {
    reasons.push({
      category: 'statistics',
      code: 'feed_stale',
      text: 'Market data feed is stale — signal generation paused.',
      polarity: 'cautionary',
    });
    return baseEval({ status: 'scanning', rejectionReason: 'Data feed not fresh' });
  }

  // Gate 1 — higher-timeframe alignment (4H and 1H must agree, non-neutral).
  const htfDir = biasToDir(htf.bias);
  const aligned = htf.bias !== 'neutral' && htf.bias === mtf.bias;
  if (!htfDir || !aligned) {
    reasons.push({
      category: 'structure',
      code: 'htf_unaligned',
      text: `Higher-timeframe context is not aligned (4H ${htf.bias}, 1H ${mtf.bias}).`,
      polarity: 'cautionary',
    });
    return baseEval({ status: 'scanning', rejectionReason: 'HTF structure not aligned' });
  }
  reasons.push({
    category: 'structure',
    code: 'htf_aligned',
    text: `4H and 1H structure both ${htf.bias} — directional context is ${htfDir}.`,
    polarity: 'supporting',
  });

  // Modes B/C/D.
  const setup = analyzeSetup(c15, htf.bias, {
    abnormalMultiple: profile.volatilityModel.abnormalMoveAtr,
  });
  for (const c of setup.confluence) {
    reasons.push({ category: 'setup', code: 'confluence', text: c, polarity: 'supporting' });
  }
  const entry = analyzeEntry(c5, setup.direction);
  if (entry.confirmed) {
    reasons.push({
      category: 'entry',
      code: 'entry_confirmed',
      text: `5M confirmation present (momentum ${entry.momentum.toFixed(2)}).`,
      polarity: 'supporting',
    });
  }
  const precision = analyzePrecision(c1m, setup.direction);
  if (precision.triggered) {
    reasons.push({
      category: 'precision',
      code: 'precision_trigger',
      text: '1M precision trigger confirmed (aligned displacement candle).',
      polarity: 'supporting',
    });
  }

  // Risk validation.
  const lastClose =
    c5[c5.length - 1]?.close ?? c15[c15.length - 1]?.close ?? htf.swings.at(-1)?.price ?? 0;
  const entryPrice = precision.refinedEntry ?? lastClose;
  const atr5 = latestAtr(c5, 14) ?? 0;
  const invalidation = setup.invalidationLevel ?? mtf.invalidationLevel;
  const { stop, takeProfits } = buildLevels(
    htfDir,
    entryPrice,
    precision.refinedStop,
    invalidation,
    atr5,
  );
  const risk = calculatePosition(
    {
      direction: htfDir,
      entry: entryPrice,
      stopLoss: stop,
      takeProfits,
      accountEquity: input.accountEquity,
      // NOTE: Deriv synthetic-index contract semantics are not conventional spot
      // sizing; valuePerPricePerUnit must be validated against the live contract
      // spec before real trading (spec §19). Defaults to 1 for analysis/paper.
      valuePerPricePerUnit: 1,
    },
    config.risk,
  );

  // Reliability & scoring.
  if (!reliability.sufficient) {
    reasons.push({
      category: 'statistics',
      code: 'insufficient_sample',
      text: `Historical sample is limited (${reliability.sampleSize}); reliability is provisional.`,
      polarity: 'cautionary',
    });
  }
  const oppScore = opportunityScore(
    {
      structureQuality: htf.quality,
      setupQuality: setup.quality,
      entryQuality: entry.quality,
      reliability: reliability.score / 100,
      riskRewardQuality: riskRewardQuality(risk.riskReward),
      marketCompatibility: marketCompatibility(htf),
    },
    config.scoringWeights,
  );

  // Qualification — every mandatory condition must hold (spec §61). Precision
  // (1M) is a REFINEMENT, not a mandatory gate: it optimises entry/stop when
  // present but never manufactures a trade on its own (spec §3, §4 Mode D).
  const gates: Array<[boolean, string]> = [
    [setup.status === 'qualified', 'Setup not qualified'],
    [entry.confirmed, '5M entry not confirmed'],
    [!risk.rejected, `Risk rejected: ${risk.rejectionReasons.join('; ')}`],
    [risk.riskReward >= config.minimumRiskReward, 'R:R below minimum'],
    [reliability.score >= config.minimumReliability, 'Reliability below minimum'],
    [oppScore >= config.minimumOpportunityScore, 'Opportunity score below minimum'],
  ];
  const firstFail = gates.find(([ok]) => !ok);
  const qualified = !firstFail;

  let status: SignalStatus;
  if (qualified) status = 'qualified';
  else if (setup.status === 'forming' || setup.status === 'qualified') status = 'developing';
  else status = 'scanning';

  if (risk.riskReward >= config.minimumRiskReward) {
    reasons.push({
      category: 'risk',
      code: 'rr_acceptable',
      text: `Risk/reward ${risk.riskReward.toFixed(2)} meets the ${config.minimumRiskReward} minimum.`,
      polarity: 'supporting',
    });
  }

  let signal: Signal | null = null;
  if (qualified) {
    const id = input.idFactory ? input.idFactory() : `sig_${input.instrument.symbol}_${input.now}`;
    signal = {
      id,
      instrumentSymbol: input.instrument.symbol,
      instrumentFamily: input.instrument.family,
      direction: htfDir,
      mode: precision.triggered ? 'precision' : 'entry',
      status: 'qualified',
      entryPrice,
      stopLoss: stop,
      takeProfits,
      riskReward: risk.riskReward,
      reliabilityScore: reliability.score,
      opportunityScore: oppScore,
      methodologyVersion: config.version,
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
      reasons,
      marketContext: { htf, mtf },
      setupContext: { setup },
      entryContext: { entry, precision },
      riskContext: {
        entry: entryPrice,
        stopLoss: stop,
        takeProfits,
        riskReward: risk.riskReward,
      },
    };
  }

  return baseEval({
    direction: htfDir,
    status,
    qualified,
    opportunityScore: oppScore,
    riskReward: risk.riskReward,
    setup,
    entry,
    precision,
    risk,
    signal,
    rejectionReason: firstFail ? firstFail[1] : null,
  });
}
