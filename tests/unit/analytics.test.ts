import { describe, it, expect } from 'vitest';
import { detectSwings } from '@/lib/analytics/swings';
import { atr, trueRange, classifyVolatility } from '@/lib/analytics/volatility';
import { analyzeStructure } from '@/lib/analytics/structure';
import type { Candle } from '@/lib/types';

/** Candle from close, with symmetric wicks. */
function bar(time: number, open: number, close: number, wick = 1): Candle {
  return {
    time,
    open,
    close,
    high: Math.max(open, close) + wick,
    low: Math.min(open, close) - wick,
  };
}

/** Build a series from a list of closes at 1m spacing. */
function fromCloses(closes: number[]): Candle[] {
  const out: Candle[] = [];
  let open = closes[0]!;
  closes.forEach((close, i) => {
    out.push(bar(i * 60, open, close));
    open = close;
  });
  return out;
}

describe('detectSwings', () => {
  it('detects a clear swing high and low with 5-bar fractals', () => {
    // Explicit [close, high, low] so the peak (idx3) and trough (idx6) are unique.
    const c: Candle[] = (
      [
        [2, 3, 1],
        [3, 4, 2],
        [5, 6, 4],
        [8, 10, 6], // unique swing high
        [5, 6, 4],
        [3, 4, 2],
        [1, 2, 0], // unique swing low
        [3, 4, 2],
        [5, 6, 4],
      ] as [number, number, number][]
    ).map(([cl, h, l], i) => ({ time: i * 60, open: cl, high: h, low: l, close: cl }));
    const swings = detectSwings(c, 2);
    expect(swings.some((s) => s.type === 'high')).toBe(true);
    expect(swings.some((s) => s.type === 'low')).toBe(true);
  });

  it('needs enough bars on each side', () => {
    const c = fromCloses([1, 5, 1]); // too short for lookback 2
    expect(detectSwings(c, 2)).toHaveLength(0);
  });
});

describe('ATR', () => {
  it('true range accounts for gaps', () => {
    const cur = bar(60, 10, 12, 0); // high 12, low 10
    expect(trueRange(cur, 5)).toBe(12 - 5); // gap up from prev close 5
  });

  it('produces a positive ATR once seeded', () => {
    const c = fromCloses([1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6, 5, 6, 7, 8]);
    const series = atr(c, 14);
    const last = series[series.length - 1];
    expect(last).not.toBeNull();
    expect(last!).toBeGreaterThan(0);
  });
});

describe('classifyVolatility', () => {
  it('flags an abnormal spike', () => {
    const calm = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 100 : 101));
    const spike = [...calm, 130, 100, 135]; // large late moves
    const cond = classifyVolatility(fromCloses(spike), 14, 3);
    expect(['elevated', 'abnormal']).toContain(cond);
  });
});

describe('analyzeStructure', () => {
  // Explicit [close, high, low] bars so swing fractals are unambiguous.
  const mkBars = (rows: [number, number, number][]): Candle[] =>
    rows.map(([c, h, l], i) => ({ time: i * 900, open: c, high: h, low: l, close: c }));

  // Swing high at idx2 (20), swing low at idx4 (9), then a close (22) breaks 20 → BOS long.
  const uptrend: [number, number, number][] = [
    [10, 12, 8],
    [14, 16, 10],
    [18, 20, 14],
    [13, 17, 11],
    [11, 15, 9],
    [17, 18, 12],
    [18, 19, 15],
    [22, 23, 16],
    [20, 24, 18],
    [25, 26, 19],
  ];

  // Mirror: swing low at idx2 (20), swing high at idx4 (31), then a close (18) breaks 20 → BOS short.
  const downtrend: [number, number, number][] = [
    [30, 32, 28],
    [26, 30, 24],
    [22, 26, 20],
    [27, 29, 23],
    [29, 31, 25],
    [23, 28, 22],
    [22, 25, 19],
    [18, 24, 17],
    [20, 22, 16],
    [15, 19, 12],
  ];

  it('reads an uptrend as bullish with a BOS', () => {
    const a = analyzeStructure(mkBars(uptrend), '15m');
    expect(a.trend).toBe('bullish');
    expect(a.events.some((e) => e.kind === 'BOS' && e.direction === 'long')).toBe(true);
    expect(a.invalidationLevel).not.toBeNull();
  });

  it('reads a downtrend as bearish', () => {
    const a = analyzeStructure(mkBars(downtrend), '15m');
    expect(a.trend).toBe('bearish');
    expect(a.events.some((e) => e.direction === 'short')).toBe(true);
  });

  it('is deterministic — same input yields identical output', () => {
    const a = analyzeStructure(mkBars(uptrend), '15m');
    const b = analyzeStructure(mkBars(uptrend), '15m');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
