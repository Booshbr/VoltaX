/**
 * Market-structure engine (spec §4 Mode A, §6). Derives trend, BOS/CHOCH events,
 * regime, volatility condition and an invalidation level from candles. Fully
 * deterministic and causal: an event at bar i uses only swings confirmed by bar i,
 * so replaying history reproduces the same events without look-ahead (spec §15).
 */
import type {
  Bias,
  Candle,
  MarketRegime,
  MarketStructureAnalysis,
  StructureEvent,
  Timeframe,
} from '@/lib/types';
import { detectSwings, lastSwings } from './swings';
import { classifyVolatility, latestAtr } from './volatility';
import { detectZones } from './zones';

export interface StructureOptions {
  lookback?: number;
  atrPeriod?: number;
  abnormalMultiple?: number;
  structureBias?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Least-squares slope of closes per bar. */
function closeSlope(candles: Candle[], window: number): number {
  const n = Math.min(window, candles.length);
  if (n < 3) return 0;
  const start = candles.length - n;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = candles[start + i]!.close;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Slope-based directional bias, used ONLY as a tiebreaker when swing/event
 * structure is inconclusive (e.g. a strong monotonic trend that forms no
 * fractal pivots). Normalised by ATR so it is scale-free.
 */
function slopeBias(candles: Candle[], atrPeriod: number): Bias {
  const atrVal = latestAtr(candles, atrPeriod);
  if (!atrVal || atrVal <= 0) return 'neutral';
  const slope = closeSlope(candles, Math.max(atrPeriod * 2, 20));
  const norm = slope / atrVal; // slope in ATRs per bar
  if (norm > 0.08) return 'bullish';
  if (norm < -0.08) return 'bearish';
  return 'neutral';
}

/** Trend from the last two swing highs and lows (HH+HL / LH+LL). */
function trendFromSwings(candles: Candle[], lookback: number): Bias {
  const swings = detectSwings(candles, lookback);
  const highs = swings.filter((s) => s.type === 'high');
  const lows = swings.filter((s) => s.type === 'low');
  if (highs.length < 2 || lows.length < 2) return 'neutral';
  const hh = highs[highs.length - 1]!.price > highs[highs.length - 2]!.price;
  const hl = lows[lows.length - 1]!.price > lows[lows.length - 2]!.price;
  const lh = highs[highs.length - 1]!.price < highs[highs.length - 2]!.price;
  const ll = lows[lows.length - 1]!.price < lows[lows.length - 2]!.price;
  if (hh && hl) return 'bullish';
  if (lh && ll) return 'bearish';
  return 'neutral';
}

/**
 * Scan candles emitting BOS/CHOCH events. A break of the most recent unbroken
 * swing high/low by a candle close is a structure event; whether it is BOS
 * (continuation) or CHOCH (reversal) depends on the trend state at that moment.
 */
function detectStructureEvents(
  candles: Candle[],
  lookback: number,
): { events: StructureEvent[]; trend: Bias } {
  const swings = detectSwings(candles, lookback);
  const events: StructureEvent[] = [];
  let trend: Bias = 'neutral';

  let pendingHigh: (typeof swings)[number] | null = null;
  let pendingLow: (typeof swings)[number] | null = null;
  let si = 0;

  for (let i = 0; i < candles.length; i++) {
    // Admit only swings confirmed by bar i (fractal needs `lookback` bars after).
    while (si < swings.length && swings[si]!.index + lookback <= i) {
      const s = swings[si]!;
      if (s.type === 'high') pendingHigh = s;
      else pendingLow = s;
      si++;
    }
    const close = candles[i]!.close;

    if (pendingHigh && pendingHigh.index < i && close > pendingHigh.price) {
      const kind = trend === 'bearish' ? 'CHOCH' : 'BOS';
      events.push({
        kind,
        direction: 'long',
        index: i,
        time: candles[i]!.time,
        level: pendingHigh.price,
      });
      trend = 'bullish';
      pendingHigh = null;
    } else if (pendingLow && pendingLow.index < i && close < pendingLow.price) {
      const kind = trend === 'bullish' ? 'CHOCH' : 'BOS';
      events.push({
        kind,
        direction: 'short',
        index: i,
        time: candles[i]!.time,
        level: pendingLow.price,
      });
      trend = 'bearish';
      pendingLow = null;
    }
  }
  return { events, trend };
}

/** Classify regime from trend clarity and volatility. */
function classifyRegime(trend: Bias, volatility: string, eventCount: number): MarketRegime {
  if (volatility === 'abnormal') return 'volatile';
  if (volatility === 'low') return 'compressed';
  if (trend !== 'neutral' && eventCount > 0) return 'trending';
  return 'ranging';
}

/**
 * Full structural analysis for a single timeframe.
 */
export function analyzeStructure(
  candles: Candle[],
  timeframe: Timeframe,
  options: StructureOptions = {},
): MarketStructureAnalysis {
  const lookback = options.lookback ?? 2;
  const atrPeriod = options.atrPeriod ?? 14;
  const abnormalMultiple = options.abnormalMultiple ?? 3;
  const structureBias = options.structureBias ?? 0;

  const swings = detectSwings(candles, lookback);
  const { events, trend: eventTrend } = detectStructureEvents(candles, lookback);
  const swingTrend = trendFromSwings(candles, lookback);
  let trend: Bias = events.length > 0 ? eventTrend : swingTrend;
  // Tiebreaker: when swing/event structure is inconclusive, fall back to a
  // slope filter so a clean monotonic trend (no fractal pivots) still reads
  // directionally instead of neutral.
  if (trend === 'neutral') trend = slopeBias(candles, atrPeriod);

  const volatility = classifyVolatility(candles, atrPeriod, abnormalMultiple);
  const regime = classifyRegime(trend, volatility, events.length);
  const zones = detectZones(candles, swings);

  // Invalidation: for a bullish read, the most recent swing low; bearish, the
  // most recent swing high. This is the level whose break negates the structure.
  const { high: lastHigh, low: lastLow } = lastSwings(swings);
  let invalidationLevel: number | null = null;
  if (trend === 'bullish') invalidationLevel = lastLow?.price ?? null;
  else if (trend === 'bearish') invalidationLevel = lastHigh?.price ?? null;

  // Quality: proportion of structure events aligned with the trend, blended with
  // data sufficiency, plus a small family-specific bias.
  const dirWord = trend === 'bullish' ? 'long' : 'short';
  const aligned = events.filter((e) => e.direction === dirWord).length;
  const total = events.length;
  const alignment = total === 0 ? 0.35 : 0.4 + 0.55 * (aligned / total);
  const sufficiency = clamp01(candles.length / (atrPeriod * 3));
  const quality = clamp01(alignment * (0.6 + 0.4 * sufficiency) + structureBias);

  return {
    timeframe,
    trend,
    regime,
    bias: trend,
    swings,
    events,
    zones,
    volatility,
    invalidationLevel,
    quality,
  };
}
