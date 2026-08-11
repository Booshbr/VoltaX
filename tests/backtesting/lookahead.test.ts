import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/signals/engine';
import { runBacktest } from '@/lib/backtesting/backtest';
import { uptrend, testInstrument } from '../helpers/candles';
import type { Candle, DataQualityStatus, Timeframe } from '@/lib/types';
import { TIMEFRAME_SECONDS } from '@/lib/types';

const fresh: DataQualityStatus = { quality: 'healthy', lastUpdateMs: 0, issues: [] };

function asOf(candles: Candle[], tf: Timeframe, ts: number): Candle[] {
  const size = TIMEFRAME_SECONDS[tf];
  return candles.filter((c) => c.time + size <= ts);
}

describe('look-ahead safety (spec §15)', () => {
  it('a past decision is invariant to future candles', () => {
    const c4 = uptrend(10, 100, 6, '4h');
    const c1 = uptrend(10, 100, 6, '1h');
    const ts = c1[10]!.time; // a mid-series decision time

    const view = {
      '4h': asOf(c4, '4h', ts),
      '1h': asOf(c1, '1h', ts),
    };
    const decisionA = evaluate({
      instrument: testInstrument,
      candles: view,
      accountEquity: 10_000,
      feed: fresh,
      now: ts,
    });

    // Mutate the FUTURE (bars strictly after ts) with wild values.
    const mutate = (arr: Candle[]) =>
      arr.map((c) => (c.time >= ts ? { ...c, close: c.close * 5, high: c.high * 5 } : c));
    const viewMutated = {
      '4h': asOf(mutate(c4), '4h', ts),
      '1h': asOf(mutate(c1), '1h', ts),
    };
    const decisionB = evaluate({
      instrument: testInstrument,
      candles: viewMutated,
      accountEquity: 10_000,
      feed: fresh,
      now: ts,
    });

    // The decision computed as-of ts must not change because of future data.
    expect(decisionB.direction).toBe(decisionA.direction);
    expect(decisionB.status).toBe(decisionA.status);
    expect(decisionB.opportunityScore).toBe(decisionA.opportunityScore);
  });

  it('backtest evaluates bars and never exits a trade before entry', () => {
    const result = runBacktest({
      instrument: testInstrument,
      candles: {
        '4h': uptrend(30, 100, 6, '4h'),
        '1h': uptrend(30, 100, 6, '1h'),
        '15m': uptrend(30, 100, 6, '15m'),
        '5m': uptrend(60, 100, 3, '5m'),
        '1m': uptrend(120, 100, 1, '1m'),
      },
      warmup: 10,
    });
    expect(result.evaluatedBars).toBeGreaterThan(0);
    for (const t of result.trades) {
      expect(t.exitTime).toBeGreaterThanOrEqual(t.entryTime);
    }
  });

  it('backtest is deterministic', () => {
    const input = {
      instrument: testInstrument,
      candles: {
        '4h': uptrend(20, 100, 6, '4h'),
        '5m': uptrend(40, 100, 3, '5m'),
        '1m': uptrend(80, 100, 1, '1m'),
      },
      warmup: 8,
    };
    expect(JSON.stringify(runBacktest(input))).toBe(JSON.stringify(runBacktest(input)));
  });
});
