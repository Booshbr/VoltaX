/**
 * Deterministic demo data generator.
 *
 * IMPORTANT (spec §77, §81): this produces SYNTHETIC, clearly-labelled candles so
 * the platform is fully explorable before a live Deriv feed / Supabase are
 * configured. The numbers the UI shows are REAL outputs of the real engine and
 * backtester over this generated data — nothing is hand-faked — but they are NOT
 * live market values and the UI labels them "Demo data" everywhere.
 *
 * Seeded so every render is reproducible.
 */
import type { Candle, Instrument, Timeframe } from '@/lib/types';
import { TIMEFRAME_SECONDS } from '@/lib/types';
import { classifyFamily } from '@/lib/config/families';
import { aggregateCandles } from '@/lib/market-data/candles';

/** mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type DemoRegime = 'uptrend' | 'downtrend' | 'range';

interface GenParams {
  n: number;
  tf: Timeframe;
  price0: number;
  drift: number; // per-bar log drift
  vol: number; // per-bar volatility
  endTime: number; // unix seconds of last candle close
  rng: () => number;
}

/** Generate one timeframe series as a drifting random walk with wicks. */
function genSeries(p: GenParams): Candle[] {
  const size = TIMEFRAME_SECONDS[p.tf];
  const startTime = p.endTime - p.n * size;
  const out: Candle[] = [];
  let price = p.price0;
  for (let i = 0; i < p.n; i++) {
    const open = price;
    const shock = (p.rng() - 0.5) * 2 * p.vol;
    price = price * Math.exp(p.drift + shock);
    const close = price;
    const wick = Math.abs(close - open) + price * p.vol * (0.3 + p.rng() * 0.7);
    const high = Math.max(open, close) + wick * p.rng();
    const low = Math.min(open, close) - wick * p.rng();
    out.push({ time: startTime + i * size, open, high, low, close });
  }
  return out;
}

/** Per-1m-bar log drift by regime (accumulates linearly; noise grows as √t, so
 * higher timeframes show a cleaner trend — as in real markets). */
const REGIME_DRIFT: Record<DemoRegime, number> = {
  uptrend: 0.00035,
  downtrend: -0.00035,
  range: 0,
};

export interface DemoDataset {
  instrument: Instrument;
  regime: DemoRegime;
  candles: Partial<Record<Timeframe, Candle[]>>;
}

/** Base 1m bars to generate; higher timeframes are AGGREGATED from these so all
 * timeframes describe one consistent underlying market (spec §9). */
const BASE_1M_BARS = 7200; // ~5 trading days of 1m data

/**
 * Build a full demo dataset for one instrument. A single 1m series is generated
 * and aggregated up to 5m/15m/1h/4h, guaranteeing cross-timeframe consistency
 * (essential for a meaningful backtest).
 */
export function generateDataset(
  symbol: string,
  displayName: string,
  regime: DemoRegime,
  now: number,
): DemoDataset {
  const seed = hashSeed(`${symbol}:${regime}`);
  const family = classifyFamily(symbol, displayName);
  const instrument: Instrument = { symbol, displayName, family, pip: 0.01, active: true };

  const price0 = 100 + (seed % 900);
  const vol = 0.0011 + (seed % 5) * 0.00025;
  const base1m = genSeries({
    n: BASE_1M_BARS,
    tf: '1m',
    price0,
    drift: REGIME_DRIFT[regime],
    vol,
    endTime: now,
    rng: mulberry32(seed),
  });

  const candles: Partial<Record<Timeframe, Candle[]>> = {
    '1m': base1m,
    '5m': aggregateCandles(base1m, '1m', '5m'),
    '15m': aggregateCandles(base1m, '1m', '15m'),
    '1h': aggregateCandles(base1m, '1m', '1h'),
    '4h': aggregateCandles(base1m, '1m', '4h'),
  };
  return { instrument, regime, candles };
}

/** A fixed roster of demo instruments across families and regimes. */
export const DEMO_INSTRUMENTS: Array<{
  symbol: string;
  name: string;
  regime: DemoRegime;
}> = [
  { symbol: 'R_10', name: 'Volatility 10 Index', regime: 'range' },
  { symbol: 'R_25', name: 'Volatility 25 Index', regime: 'uptrend' },
  { symbol: 'R_50', name: 'Volatility 50 Index', regime: 'downtrend' },
  { symbol: 'R_75', name: 'Volatility 75 Index', regime: 'uptrend' },
  { symbol: 'R_100', name: 'Volatility 100 Index', regime: 'downtrend' },
  { symbol: 'BOOM500', name: 'Boom 500 Index', regime: 'uptrend' },
  { symbol: 'BOOM1000', name: 'Boom 1000 Index', regime: 'range' },
  { symbol: 'CRASH500', name: 'Crash 500 Index', regime: 'downtrend' },
  { symbol: 'CRASH1000', name: 'Crash 1000 Index', regime: 'range' },
  { symbol: 'JD10', name: 'Jump 10 Index', regime: 'uptrend' },
  { symbol: 'JD50', name: 'Jump 50 Index', regime: 'downtrend' },
  { symbol: 'STPRNG', name: 'Step Index', regime: 'range' },
];
