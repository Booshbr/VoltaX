import { describe, it, expect } from 'vitest';
import { toInstrument, toInstruments, toCandles } from '@/lib/deriv/mappers';
import type { DerivActiveSymbol, DerivCandle } from '@/lib/deriv/types';

const vol75: DerivActiveSymbol = {
  symbol: 'R_75',
  display_name: 'Volatility 75 Index',
  market: 'synthetic_index',
  submarket: 'random_index',
  submarket_display_name: 'Continuous Indices',
  exchange_is_open: 1,
  is_trading_suspended: 0,
  pip: 0.01,
};

const boom500: DerivActiveSymbol = {
  ...vol75,
  symbol: 'BOOM500',
  display_name: 'Boom 500 Index',
  is_trading_suspended: 1,
};

const forex: DerivActiveSymbol = {
  ...vol75,
  symbol: 'frxEURUSD',
  display_name: 'EUR/USD',
  market: 'forex',
  submarket: 'major_pairs',
};

describe('toInstrument', () => {
  it('classifies family and open state', () => {
    const inst = toInstrument(vol75);
    expect(inst.family).toBe('volatility');
    expect(inst.active).toBe(true);
    expect(inst.pip).toBe(0.01);
  });

  it('marks a suspended symbol inactive and classifies boom', () => {
    const inst = toInstrument(boom500);
    expect(inst.family).toBe('boom');
    expect(inst.active).toBe(false);
  });

  it('falls back to a safe pip when provider pip is invalid', () => {
    expect(toInstrument({ ...vol75, pip: 0 }).pip).toBe(0.01);
  });
});

describe('toInstruments', () => {
  it('keeps only synthetic-index markets', () => {
    const list = toInstruments([vol75, boom500, forex]);
    expect(list.map((i) => i.symbol)).toEqual(['R_75', 'BOOM500']);
  });
});

describe('toCandles', () => {
  it('maps epoch to time and preserves OHLC', () => {
    const raw: DerivCandle[] = [{ epoch: 1700, open: 1, high: 2, low: 0.5, close: 1.5 }];
    const [c] = toCandles(raw);
    expect(c).toEqual({ time: 1700, open: 1, high: 2, low: 0.5, close: 1.5 });
  });
});
