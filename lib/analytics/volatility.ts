/**
 * Volatility measures (spec §6 volatility). ATR (Wilder), realised volatility,
 * and a regime classifier. All causal — computed only from candles up to the
 * evaluation point.
 */
import type { Candle, VolatilityCondition } from '@/lib/types';

/** True Range for candle i given the previous close. */
export function trueRange(cur: Candle, prevClose: number): number {
  return Math.max(
    cur.high - cur.low,
    Math.abs(cur.high - prevClose),
    Math.abs(cur.low - prevClose),
  );
}

/**
 * Wilder's Average True Range over `period`. Returns an array aligned to
 * `candles`; entries before enough data are `null`.
 */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(trueRange(candles[i]!, candles[i - 1]!.close));
  }
  // Seed with a simple average of the first `period` TRs.
  let prevAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period] = prevAtr;
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trs[i - 1]!;
    prevAtr = (prevAtr * (period - 1) + tr) / period;
    out[i] = prevAtr;
  }
  return out;
}

/** Latest non-null ATR value, or null. */
export function latestAtr(candles: Candle[], period = 14): number | null {
  const series = atr(candles, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null) return series[i]!;
  }
  return null;
}

/** Standard deviation of log returns over the last `window` candles. */
export function realizedVolatility(candles: Candle[], window = 20): number | null {
  if (candles.length < window + 1) return null;
  const rets: number[] = [];
  for (let i = candles.length - window; i < candles.length; i++) {
    const prev = candles[i - 1]!.close;
    const cur = candles[i]!.close;
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

/**
 * Classify the current volatility condition by comparing the latest ATR to its
 * recent baseline. `abnormalMultiple` (from the family profile) flags spikes.
 */
export function classifyVolatility(
  candles: Candle[],
  period = 14,
  abnormalMultiple = 3,
): VolatilityCondition {
  const series = atr(candles, period);
  const values = series.filter((v): v is number => v !== null);
  if (values.length < 5) return 'normal';

  const latest = values[values.length - 1]!;
  const baseline =
    values.slice(0, -1).reduce((a, b) => a + b, 0) / (values.length - 1);
  if (baseline <= 0) return 'normal';

  const ratio = latest / baseline;
  if (ratio >= abnormalMultiple) return 'abnormal';
  if (ratio >= 1.4) return 'elevated';
  if (ratio <= 0.6) return 'low';
  return 'normal';
}
