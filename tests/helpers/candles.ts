import type { Candle, Instrument, Timeframe } from '@/lib/types';
import { TIMEFRAME_SECONDS } from '@/lib/types';

/** Explicit [close, high, low] bars at a given timeframe spacing. */
export function mkBars(
  rows: [number, number, number][],
  tf: Timeframe = '15m',
  start = 0,
): Candle[] {
  const size = TIMEFRAME_SECONDS[tf];
  return rows.map(([c, h, l], i) => ({
    time: start + i * size,
    open: c,
    high: h,
    low: l,
    close: c,
  }));
}

/**
 * A clean staircase uptrend with real pullbacks so swing fractals and BOS form.
 * `n` legs, each: push up then pull back.
 */
export function uptrend(n = 8, base = 100, step = 5, tf: Timeframe = '4h'): Candle[] {
  const rows: [number, number, number][] = [];
  let price = base;
  for (let i = 0; i < n; i++) {
    price += step;
    rows.push([price, price + 1, price - step]); // impulse up
    rows.push([price - step * 0.4, price + 1, price - step * 0.5]); // pullback
  }
  return mkBars(rows, tf);
}

export function downtrend(n = 8, base = 200, step = 5, tf: Timeframe = '4h'): Candle[] {
  const rows: [number, number, number][] = [];
  let price = base;
  for (let i = 0; i < n; i++) {
    price -= step;
    rows.push([price, price + step, price - 1]);
    rows.push([price + step * 0.4, price + step * 0.5, price - 1]);
  }
  return mkBars(rows, tf);
}

/** Flat, choppy series → neutral structure. */
export function choppy(n = 20, base = 100, tf: Timeframe = '4h'): Candle[] {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = base + (i % 2 === 0 ? 1 : -1);
    rows.push([c, c + 1, c - 1]);
  }
  return mkBars(rows, tf);
}

export const testInstrument: Instrument = {
  symbol: 'R_75',
  displayName: 'Volatility 75 Index',
  family: 'volatility',
  pip: 0.01,
  active: true,
};
