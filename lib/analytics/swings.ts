/**
 * Swing-point detection (spec §6 price structure). A swing high/low is a fractal
 * pivot: a bar whose high/low is the most extreme within `lookback` bars either
 * side. Deterministic and causal — a pivot at index i is only *confirmed* once
 * `lookback` further bars exist, which the signal engine relies on to avoid
 * look-ahead when replaying history (spec §15).
 */
import type { Candle, SwingPoint } from '@/lib/types';

/**
 * Detect confirmed swing pivots. `lookback` is the number of bars required on
 * each side (default 2 = a 5-bar fractal).
 */
export function detectSwings(candles: Candle[], lookback = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      const o = candles[j]!;
      if (o.high >= c.high) isHigh = false;
      if (o.low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) {
      swings.push({ type: 'high', index: i, time: c.time, price: c.high });
    } else if (isLow) {
      swings.push({ type: 'low', index: i, time: c.time, price: c.low });
    }
  }
  return swings;
}

/** The most recent confirmed swing of each type, or null. */
export function lastSwings(swings: SwingPoint[]): {
  high: SwingPoint | null;
  low: SwingPoint | null;
} {
  let high: SwingPoint | null = null;
  let low: SwingPoint | null = null;
  for (const s of swings) {
    if (s.type === 'high') high = s;
    else low = s;
  }
  return { high, low };
}
