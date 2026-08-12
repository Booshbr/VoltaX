/**
 * Live market view from real Deriv candles (spec §9, §13). SERVER-SIDE ONLY.
 * Fetches candles for the discovered instrument universe, runs the SAME engine +
 * backtester used everywhere, and reuses the data-quality subsystem to gate on
 * feed freshness (spec §39, §40). Results are cached briefly to keep pages fast
 * and stay well within Deriv rate limits.
 */
import type { Candle, Instrument, Timeframe } from '@/lib/types';
import { TIMEFRAMES } from '@/lib/types';
import { evaluate, type EngineEvaluation } from '@/lib/signals/engine';
import { runBacktest, type BacktestResult } from '@/lib/backtesting/backtest';
import { assessFeed } from '@/lib/market-data/quality';
import { researchAnalogs } from '@/lib/research/patterns';
import { getDerivClient } from './client';
import { KNOWN_SYNTHETICS } from './symbols';
import { classifyFamily } from '@/lib/config/families';
import { summarize, type MarketDetail, type MarketView } from '@/lib/market/types';

const CANDLE_COUNT = 300;
const FETCH_CONCURRENCY = 3;
const CACHE_TTL_MS = 60_000;
const EQUITY = 10_000;

interface LiveInstrumentData {
  instrument: Instrument;
  candles: Partial<Record<Timeframe, Candle[]>>;
  backtest: BacktestResult;
  evaluation: EngineEvaluation;
}

interface LiveCache {
  at: number;
  data: LiveInstrumentData[];
  view: MarketView;
}

let cache: LiveCache | null = null;
let inflight: Promise<LiveCache> | null = null;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Newest candle close time (ms) across a candle set, for freshness. */
function newestCloseMs(candles: Partial<Record<Timeframe, Candle[]>>): number {
  const oneMin = candles['1m'] ?? [];
  const last = oneMin[oneMin.length - 1];
  return last ? (last.time + 60) * 1000 : 0;
}

async function build(): Promise<LiveCache> {
  const client = await getDerivClient();
  const instruments = await client.getInstruments();
  // Prefer the discovered universe; if it is unexpectedly small, use the curated set.
  const roster = instruments.length >= 3
    ? instruments.slice(0, 12)
    : KNOWN_SYNTHETICS.map((k) => ({
        symbol: k.symbol,
        displayName: k.displayName,
        family: classifyFamily(k.symbol, k.displayName),
        pip: 0.01,
        active: true,
      }));

  const data = await mapLimit<Instrument, LiveInstrumentData | null>(roster, FETCH_CONCURRENCY, async (inst) => {
    try {
      const { candles, digits } = await client.getCandleSet(inst.symbol, [...TIMEFRAMES], CANDLE_COUNT);
      const instrument: Instrument = { ...inst, pip: Math.pow(10, -digits) };
      const backtest = runBacktest({ instrument, candles, warmup: 30 });

      const nowSec = Math.floor(newestCloseMs(candles) / 1000) || Math.floor(Date.now() / 1000);
      const lastUpdateMs = Date.now() - newestCloseMs(candles);
      const feed = assessFeed(lastUpdateMs, (candles['1m'] ?? []).slice(-30), '1m');

      const evaluation = evaluate({
        instrument,
        candles,
        accountEquity: EQUITY,
        feed,
        now: nowSec,
        sample: { wins: backtest.wins, losses: backtest.losses },
      });
      return { instrument, candles, backtest, evaluation };
    } catch {
      return null; // one bad symbol must not fail the whole view
    }
  });

  const clean = data.filter((d): d is LiveInstrumentData => d !== null);
  const evaluations = clean.map((d) => d.evaluation).sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Overall feed freshness = the freshest instrument (they share the provider clock).
  const freshest = clean.reduce((min, d) => {
    const age = Date.now() - newestCloseMs(d.candles);
    return age < min ? age : min;
  }, Number.POSITIVE_INFINITY);
  const feed = assessFeed(Number.isFinite(freshest) ? freshest : Infinity, [], '1m');

  const view: MarketView = {
    source: 'live',
    generatedAt: new Date().toISOString(),
    feed,
    evaluations,
    summary: summarize(evaluations),
    accountEquity: EQUITY,
  };
  return { at: Date.now(), data: clean, view };
}

async function getLive(): Promise<LiveCache> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = build()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function getLiveMarketView(): Promise<MarketView> {
  return (await getLive()).view;
}

export interface LivePerformanceRow {
  symbol: string;
  family: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectancyR: number;
}

/** Aggregate live backtests into portfolio metrics (spec §26), from cache. */
export async function getLivePerformance(): Promise<{
  rows: LivePerformanceRow[];
  totals: { trades: number; wins: number; losses: number; winRate: number | null; expectancyR: number; profitFactor: number | null };
}> {
  const { data } = await getLive();
  const rows: LivePerformanceRow[] = [];
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let grossWinR = 0;
  let grossLossR = 0;
  for (const d of data) {
    const bt = d.backtest;
    trades += bt.trades.length;
    wins += bt.wins;
    losses += bt.losses;
    for (const t of bt.trades) {
      if (t.rMultiple >= 0) grossWinR += t.rMultiple;
      else grossLossR += Math.abs(t.rMultiple);
    }
    rows.push({
      symbol: d.instrument.symbol,
      family: d.instrument.family,
      trades: bt.trades.length,
      wins: bt.wins,
      losses: bt.losses,
      winRate: bt.winRate,
      expectancyR: bt.expectancyR,
    });
  }
  rows.sort((a, b) => b.expectancyR - a.expectancyR);
  return {
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
}

export async function getLiveDetail(symbol: string): Promise<MarketDetail | undefined> {
  const { data } = await getLive();
  const found = data.find((d) => d.instrument.symbol === symbol);
  if (!found) return undefined;
  const c15 = found.candles['15m'] ?? [];
  return {
    source: 'live',
    evaluation: found.evaluation,
    backtest: found.backtest,
    recentCandles: c15.slice(-80),
    timeframe: '15m',
    research: researchAnalogs(c15, { window: 20, forward: 10, k: 8 }),
  };
}
