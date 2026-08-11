/**
 * Event-driven backtester (spec §15, §62). Replays history bar-by-bar through the
 * SAME strategy engine used live. At each decision point it only exposes candles
 * whose close time is at or before "now" — this is the structural guard against
 * look-ahead / future leakage (spec §15 "Never use future candles").
 */
import type { Candle, Instrument, Timeframe } from '@/lib/types';
import { TIMEFRAME_SECONDS } from '@/lib/types';
import { DEFAULT_STRATEGY, type StrategyConfig } from '@/lib/config/strategy';
import { evaluate } from '@/lib/signals/engine';

export interface BacktestInput {
  instrument: Instrument;
  candles: Partial<Record<Timeframe, Candle[]>>;
  /** Timeframe whose bars drive the decision cadence (default 5m). */
  decisionTimeframe?: Timeframe;
  accountEquity?: number;
  config?: StrategyConfig;
  /** Bars to skip at the start so analyses have data (default 40 decision bars). */
  warmup?: number;
}

export interface BacktestTrade {
  direction: 'long' | 'short';
  entryTime: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitTime: number;
  exitPrice: number;
  result: 'win' | 'loss';
  /** Realised reward-to-risk (positive win, negative loss). */
  rMultiple: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  wins: number;
  losses: number;
  winRate: number | null;
  expectancyR: number;
  /** Decision bars where the engine confirmed it used only past data. */
  evaluatedBars: number;
}

/** Candles known at decision time `ts`: close time (time+size) at or before ts. */
function asOf(candles: Candle[], tf: Timeframe, ts: number): Candle[] {
  const size = TIMEFRAME_SECONDS[tf];
  return candles.filter((c) => c.time + size <= ts);
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const config = input.config ?? DEFAULT_STRATEGY;
  const decisionTf = input.decisionTimeframe ?? '5m';
  const warmup = input.warmup ?? 40;
  const equity = input.accountEquity ?? 10_000;

  const driver = input.candles[decisionTf] ?? [];
  const oneMin = input.candles['1m'] ?? driver;
  const trades: BacktestTrade[] = [];
  let evaluatedBars = 0;
  let cursor = warmup;

  while (cursor < driver.length) {
    const bar = driver[cursor]!;
    const ts = bar.time + TIMEFRAME_SECONDS[decisionTf]; // decision at bar close

    const view: Partial<Record<Timeframe, Candle[]>> = {};
    for (const tf of Object.keys(input.candles) as Timeframe[]) {
      view[tf] = asOf(input.candles[tf]!, tf, ts);
    }

    const evalResult = evaluate({
      instrument: input.instrument,
      candles: view,
      accountEquity: equity,
      feed: { quality: 'healthy', lastUpdateMs: 0, issues: [] },
      now: ts,
      config,
    });
    evaluatedBars++;

    if (evalResult.qualified && evalResult.signal) {
      const s = evalResult.signal;
      const tp1 = s.takeProfits[0]!.price;
      const trade = simulateTrade(oneMin, ts, s.direction, s.entryPrice, s.stopLoss, tp1);
      if (trade) {
        trades.push(trade);
        // Resume scanning after the trade closes to avoid overlapping positions.
        const resumeTime = trade.exitTime;
        while (cursor < driver.length && driver[cursor]!.time <= resumeTime) cursor++;
        continue;
      }
    }
    cursor++;
  }

  const wins = trades.filter((t) => t.result === 'win').length;
  const losses = trades.length - wins;
  const expectancyR =
    trades.length === 0
      ? 0
      : trades.reduce((a, t) => a + t.rMultiple, 0) / trades.length;

  return {
    trades,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length : null,
    expectancyR,
    evaluatedBars,
  };
}

/** Walk forward from entry to the first stop/TP touch. Stop is checked first
 * within a bar (conservative — assumes the adverse level trades first). */
function simulateTrade(
  candles: Candle[],
  fromTime: number,
  direction: 'long' | 'short',
  entry: number,
  stop: number,
  tp: number,
): BacktestTrade | null {
  const r = Math.abs(entry - stop);
  if (r <= 0) return null;
  for (const c of candles) {
    if (c.time < fromTime) continue;
    if (direction === 'long') {
      if (c.low <= stop) return close(c, 'loss', -1);
      if (c.high >= tp) return close(c, 'win', Math.abs(tp - entry) / r);
    } else {
      if (c.high >= stop) return close(c, 'loss', -1);
      if (c.low <= tp) return close(c, 'win', Math.abs(tp - entry) / r);
    }
  }
  return null; // trade never resolved within available data — not counted

  function close(c: Candle, result: 'win' | 'loss', rMultiple: number): BacktestTrade {
    return {
      direction,
      entryTime: fromTime,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: tp,
      exitTime: c.time,
      exitPrice: result === 'win' ? tp : stop,
      result,
      rMultiple,
    };
  }
}
