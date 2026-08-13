/**
 * Assemble the demo market view: run every demo instrument through the REAL
 * engine + backtester and produce ranked evaluations. This is the same call path
 * a live data source would use — only the candle source differs (spec §62 parity).
 */
import { evaluate, type EngineEvaluation } from '@/lib/signals/engine';
import { runBacktest, type BacktestResult } from '@/lib/backtesting/backtest';
import { researchAnalogs, type ResearchResult } from '@/lib/research/patterns';
import type { Candle, DataQualityStatus, Timeframe } from '@/lib/types';
import { DEMO_INSTRUMENTS, generateDataset } from './generator';

export interface MarketView {
  isDemo: true;
  generatedAt: string;
  feed: DataQualityStatus;
  evaluations: EngineEvaluation[];
  summary: {
    scanned: number;
    bullish: number;
    bearish: number;
    neutral: number;
    qualified: number;
    developing: number;
  };
  accountEquity: number;
}

/** Fixed anchor time keeps demo output stable across renders within a session. */
const DEMO_NOW = 1_723_000_000; // ~2024, arbitrary fixed epoch seconds
const DEMO_EQUITY = 10_000;

let cached: MarketView | null = null;

/** Build (and memoise) the demo market view. */
export function getDemoMarketView(): MarketView {
  if (cached) return cached;

  const feed: DataQualityStatus = {
    quality: 'healthy',
    lastUpdateMs: 800,
    issues: [],
  };

  const evaluations: EngineEvaluation[] = DEMO_INSTRUMENTS.map((d) => {
    const ds = generateDataset(d.symbol, d.name, d.regime, DEMO_NOW);

    // Reliability comes from a real backtest over this instrument's own history —
    // not fabricated (spec §14, §81).
    const bt = runBacktest({
      instrument: ds.instrument,
      candles: ds.candles,
      warmup: 30,
    });

    return evaluate({
      instrument: ds.instrument,
      candles: ds.candles,
      accountEquity: DEMO_EQUITY,
      feed,
      now: DEMO_NOW,
      sample: { wins: bt.wins, losses: bt.losses },
    });
  });

  // Rank by opportunity score, strongest first.
  evaluations.sort((a, b) => b.opportunityScore - a.opportunityScore);

  const summary = {
    scanned: evaluations.length,
    bullish: evaluations.filter((e) => e.htf.bias === 'bullish').length,
    bearish: evaluations.filter((e) => e.htf.bias === 'bearish').length,
    neutral: evaluations.filter((e) => e.htf.bias === 'neutral').length,
    qualified: evaluations.filter((e) => e.qualified).length,
    developing: evaluations.filter((e) => e.status === 'developing').length,
  };

  cached = {
    isDemo: true,
    generatedAt: new Date(DEMO_NOW * 1000).toISOString(),
    feed,
    evaluations,
    summary,
    accountEquity: DEMO_EQUITY,
  };
  return cached;
}

/** Find one evaluation by symbol. */
export function getDemoEvaluation(symbol: string): EngineEvaluation | undefined {
  return getDemoMarketView().evaluations.find((e) => e.instrumentSymbol === symbol);
}

// Cache generated datasets so repeated chart requests don't re-generate.
const datasetCache = new Map<string, ReturnType<typeof generateDataset>>();

/** Raw candles for one demo symbol/timeframe (spec §25). */
export function getDemoCandles(symbol: string, tf: Timeframe): Candle[] {
  const meta = DEMO_INSTRUMENTS.find((d) => d.symbol === symbol);
  if (!meta) return [];
  let ds = datasetCache.get(symbol);
  if (!ds) {
    ds = generateDataset(meta.symbol, meta.name, meta.regime, DEMO_NOW);
    datasetCache.set(symbol, ds);
  }
  return ds.candles[tf] ?? [];
}

export interface DemoPerformanceRow {
  symbol: string;
  family: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectancyR: number;
}

export interface DemoPerformance {
  rows: DemoPerformanceRow[];
  totals: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number | null;
    expectancyR: number;
    profitFactor: number | null;
  };
}

let perfCache: DemoPerformance | null = null;

/** Aggregate backtests across the demo universe into portfolio-level metrics
 * (spec §26). All figures are real backtest outputs over demo data. */
export function getDemoPerformance(): DemoPerformance {
  if (perfCache) return perfCache;
  const rows: DemoPerformanceRow[] = [];
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let grossWinR = 0;
  let grossLossR = 0;

  for (const meta of DEMO_INSTRUMENTS) {
    const detail = getDemoDetail(meta.symbol);
    if (!detail) continue;
    const bt = detail.backtest;
    trades += bt.trades.length;
    wins += bt.wins;
    losses += bt.losses;
    for (const t of bt.trades) {
      if (t.rMultiple >= 0) grossWinR += t.rMultiple;
      else grossLossR += Math.abs(t.rMultiple);
    }
    rows.push({
      symbol: meta.symbol,
      family: detail.evaluation.family,
      trades: bt.trades.length,
      wins: bt.wins,
      losses: bt.losses,
      winRate: bt.winRate,
      expectancyR: bt.expectancyR,
    });
  }

  rows.sort((a, b) => b.expectancyR - a.expectancyR);
  perfCache = {
    rows,
    totals: {
      trades,
      wins,
      losses,
      winRate: trades ? wins / trades : null,
      expectancyR: trades ? (grossWinR - grossLossR) / trades : 0,
      profitFactor: grossLossR > 0 ? grossWinR / grossLossR : null,
    },
  };
  return perfCache;
}

export interface DemoDetail {
  evaluation: EngineEvaluation;
  backtest: BacktestResult;
  recentCandles: Candle[];
  timeframe: Timeframe;
  research: ResearchResult;
}

const detailCache = new Map<string, DemoDetail>();

/** Full detail for one symbol: evaluation + its backtest + recent candles for a
 * chart. Recomputed once per symbol and cached. */
export function getDemoDetail(symbol: string): DemoDetail | undefined {
  if (detailCache.has(symbol)) return detailCache.get(symbol);
  const meta = DEMO_INSTRUMENTS.find((d) => d.symbol === symbol);
  if (!meta) return undefined;

  const ds = generateDataset(meta.symbol, meta.name, meta.regime, DEMO_NOW);
  const backtest = runBacktest({ instrument: ds.instrument, candles: ds.candles, warmup: 30 });
  const evaluation = evaluate({
    instrument: ds.instrument,
    candles: ds.candles,
    accountEquity: DEMO_EQUITY,
    feed: { quality: 'healthy', lastUpdateMs: 800, issues: [] },
    now: DEMO_NOW,
    sample: { wins: backtest.wins, losses: backtest.losses },
  });
  const c15 = ds.candles['15m'] ?? [];
  const detail: DemoDetail = {
    evaluation,
    backtest,
    recentCandles: c15.slice(-80),
    timeframe: '15m',
    research: researchAnalogs(c15, { window: 20, forward: 10, k: 8 }),
  };
  detailCache.set(symbol, detail);
  return detail;
}
