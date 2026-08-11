import { describe, it, expect } from 'vitest';
import {
  aggregateCandles,
  bucketStart,
  canAggregate,
  detectGaps,
  dedupeAndSort,
  isValidCandle,
} from '@/lib/market-data/candles';
import type { Candle } from '@/lib/types';

/** Build a minute series starting at `start` with given closes (o=prev close). */
function minuteSeries(start: number, closes: number[]): Candle[] {
  const out: Candle[] = [];
  let open = closes[0]!;
  for (let i = 0; i < closes.length; i++) {
    const close = closes[i]!;
    out.push({
      time: start + i * 60,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
    });
    open = close;
  }
  return out;
}

describe('canAggregate', () => {
  it('allows evenly-dividing upscale', () => {
    expect(canAggregate('1m', '5m')).toBe(true);
    expect(canAggregate('15m', '1h')).toBe(true);
    expect(canAggregate('1h', '4h')).toBe(true);
  });
  it('rejects same or downscale', () => {
    expect(canAggregate('5m', '5m')).toBe(false);
    expect(canAggregate('1h', '15m')).toBe(false);
  });
});

describe('bucketStart', () => {
  it('anchors buckets to the epoch in UTC', () => {
    // 5m bucket: 09:02:30 -> 09:00:00
    const t = 1_700_000_000; // arbitrary
    expect(bucketStart(t, '5m') % 300).toBe(0);
    expect(bucketStart(t, '1h') % 3600).toBe(0);
    expect(bucketStart(t, '5m')).toBeLessThanOrEqual(t);
  });
});

describe('aggregateCandles', () => {
  it('aggregates 1m into 5m with correct OHLC', () => {
    const start = bucketStart(1_700_000_000, '5m');
    const src = minuteSeries(start, [10, 12, 9, 11, 13]); // one full 5m bucket
    const agg = aggregateCandles(src, '1m', '5m');
    expect(agg).toHaveLength(1);
    const c = agg[0]!;
    expect(c.time).toBe(start);
    expect(c.open).toBe(10); // first open
    expect(c.close).toBe(13); // last close
    expect(c.high).toBe(14); // max high (13+1)
    expect(c.low).toBe(8); // min low (9-1)
  });

  it('drops an incomplete trailing bucket (no partial candles)', () => {
    const start = bucketStart(1_700_000_000, '5m');
    // 5 complete + 2 into the next bucket
    const src = minuteSeries(start, [10, 12, 9, 11, 13, 14, 15]);
    const agg = aggregateCandles(src, '1m', '5m');
    expect(agg).toHaveLength(1); // second bucket incomplete -> dropped
  });

  it('sums volume only when present', () => {
    const start = bucketStart(1_700_000_000, '5m');
    const src = minuteSeries(start, [1, 2, 3, 4, 5]).map((c, i) => ({
      ...c,
      volume: i + 1,
    }));
    const agg = aggregateCandles(src, '1m', '5m');
    expect(agg[0]!.volume).toBe(1 + 2 + 3 + 4 + 5);
  });

  it('throws on invalid aggregation direction', () => {
    expect(() => aggregateCandles([], '1h', '5m')).toThrow();
  });
});

describe('detectGaps', () => {
  it('finds a missing 1m candle', () => {
    const start = bucketStart(1_700_000_000, '1m');
    const c = minuteSeries(start, [1, 2, 3, 4]);
    c.splice(2, 1); // remove the 3rd candle -> one gap
    const gaps = detectGaps(c, '1m');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.expectedTime).toBe(start + 2 * 60);
  });
});

describe('dedupeAndSort', () => {
  it('keeps the last write for a duplicate timestamp and sorts ascending', () => {
    const t = 1_700_000_000;
    const a: Candle = { time: t, open: 1, high: 2, low: 0, close: 1 };
    const b: Candle = { time: t, open: 1, high: 5, low: 0, close: 4 }; // update
    const c: Candle = { time: t - 60, open: 1, high: 2, low: 0, close: 1 };
    const out = dedupeAndSort([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0]!.time).toBe(t - 60);
    expect(out[1]!.close).toBe(4); // later write wins
  });
});

describe('isValidCandle', () => {
  it('accepts a well-formed candle', () => {
    expect(isValidCandle({ time: 1, open: 5, high: 6, low: 4, close: 5 })).toBe(true);
  });
  it('rejects high < low and non-finite values', () => {
    expect(isValidCandle({ time: 1, open: 5, high: 4, low: 6, close: 5 })).toBe(false);
    expect(isValidCandle({ time: 1, open: NaN, high: 6, low: 4, close: 5 })).toBe(false);
  });
});
