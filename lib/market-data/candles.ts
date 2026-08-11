/**
 * Candle / timeframe engine (spec §9). Deterministic, provider-agnostic, and
 * heavily tested. Aggregation is only performed when semantically valid: the
 * source timeframe must evenly divide the target (spec §9 "Do not blindly
 * aggregate if the source data semantics make aggregation inappropriate").
 */
import {
  type Candle,
  type Timeframe,
  TIMEFRAME_SECONDS,
} from '@/lib/types';

/** True when `source` candles can be losslessly aggregated into `target`. */
export function canAggregate(source: Timeframe, target: Timeframe): boolean {
  const s = TIMEFRAME_SECONDS[source];
  const t = TIMEFRAME_SECONDS[target];
  return t > s && t % s === 0;
}

/**
 * Normalise a Unix-second timestamp down to the start of its timeframe bucket.
 * Buckets are anchored to the Unix epoch (UTC), which keeps 1m→4h boundaries
 * consistent and reproducible across runs.
 */
export function bucketStart(timeSeconds: number, tf: Timeframe): number {
  const size = TIMEFRAME_SECONDS[tf];
  return Math.floor(timeSeconds / size) * size;
}

/**
 * Aggregate a sorted array of source candles into `target` candles.
 * Assumptions enforced:
 *  - source is ascending by time and of a single, evenly-dividing timeframe;
 *  - only COMPLETE target buckets are emitted (the trailing partial bucket is
 *    dropped) to avoid look-ahead / partial-candle bias in analysis (spec §15).
 */
export function aggregateCandles(
  source: Candle[],
  from: Timeframe,
  to: Timeframe,
): Candle[] {
  if (from === to) return [...source];
  if (!canAggregate(from, to)) {
    throw new Error(`Cannot aggregate ${from} into ${to}: not an even divisor`);
  }
  if (source.length === 0) return [];

  const factor = TIMEFRAME_SECONDS[to] / TIMEFRAME_SECONDS[from];
  const buckets = new Map<number, { candles: Candle[] }>();
  const order: number[] = [];

  for (const c of source) {
    const key = bucketStart(c.time, to);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { candles: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.candles.push(c);
  }

  const result: Candle[] = [];
  for (const key of order) {
    const group = buckets.get(key)!.candles;
    // Drop incomplete trailing buckets — never analyse a half-formed candle.
    if (group.length < factor) continue;

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    let hasVolume = false;
    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      if (typeof c.volume === 'number') {
        volume += c.volume;
        hasVolume = true;
      }
    }
    const candle: Candle = {
      time: key,
      open: group[0]!.open,
      high,
      low,
      close: group[group.length - 1]!.close,
    };
    if (hasVolume) candle.volume = volume;
    result.push(candle);
  }
  return result;
}

export interface CandleGap {
  /** Bucket time that is missing between two present candles. */
  expectedTime: number;
  afterIndex: number;
}

/** Detect missing buckets in a sorted, single-timeframe candle series (spec §40). */
export function detectGaps(candles: Candle[], tf: Timeframe): CandleGap[] {
  const size = TIMEFRAME_SECONDS[tf];
  const gaps: CandleGap[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    let expected = prev.time + size;
    while (expected < cur.time) {
      gaps.push({ expectedTime: expected, afterIndex: i - 1 });
      expected += size;
    }
  }
  return gaps;
}

/**
 * Remove duplicate timestamps (spec §40 duplicate detection), keeping the LAST
 * occurrence — a later update for the same bucket supersedes an earlier one.
 * Also returns a stably sorted ascending series.
 */
export function dedupeAndSort(candles: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of candles) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** A candle is malformed if OHLC invariants are violated (spec §40). */
export function isValidCandle(c: Candle): boolean {
  const finite = [c.open, c.high, c.low, c.close, c.time].every(Number.isFinite);
  if (!finite) return false;
  if (c.high < c.low) return false;
  if (c.high < c.open || c.high < c.close) return false;
  if (c.low > c.open || c.low > c.close) return false;
  return true;
}

/** Filter a series to only structurally valid candles. */
export function validCandles(candles: Candle[]): Candle[] {
  return candles.filter(isValidCandle);
}
