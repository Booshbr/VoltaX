/**
 * Entry & precision engines — MODE C (5M) and MODE D (1M) (spec §4 Mode C/D).
 * Both refine an already-qualified setup; they never manufacture a trade from
 * noise (spec §3 "1M should refine an already qualified setup").
 */
import type {
  Candle,
  Direction,
  EntryAnalysis,
  PrecisionAnalysis,
} from '@/lib/types';
import { analyzeStructure } from './structure';
import { latestAtr } from './volatility';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Momentum: last close move over `window`, normalised by ATR, signed. */
function normalizedMomentum(candles: Candle[], window = 5, atrPeriod = 14): number {
  if (candles.length < window + 1) return 0;
  const atr = latestAtr(candles, atrPeriod);
  if (!atr || atr <= 0) return 0;
  const last = candles[candles.length - 1]!.close;
  const prev = candles[candles.length - 1 - window]!.close;
  return (last - prev) / (atr * window);
}

/** MODE C — 5M confirmation aligned with the setup direction. */
export function analyzeEntry(
  candles: Candle[],
  setupDirection: Direction | null,
  atrPeriod = 14,
): EntryAnalysis {
  const structure = analyzeStructure(candles, '5m', { atrPeriod });
  const last = candles[candles.length - 1];
  const base: EntryAnalysis = {
    timeframe: '5m',
    confirmed: false,
    direction: null,
    localStructure: structure.bias,
    momentum: 0,
    entryArea: last?.close ?? null,
    invalidationLevel: structure.invalidationLevel,
    quality: 0,
  };
  if (!setupDirection || !last) return base;

  const momentum = normalizedMomentum(candles, 5, atrPeriod);
  const wantBull = setupDirection === 'long';
  const structureAligned =
    (wantBull && structure.bias === 'bullish') ||
    (!wantBull && structure.bias === 'bearish');
  const momentumAligned = wantBull ? momentum > 0.1 : momentum < -0.1;

  const confirmed = structureAligned && momentumAligned;
  const quality = clamp01(
    structure.quality * 0.5 +
      (structureAligned ? 0.25 : 0) +
      Math.min(Math.abs(momentum), 1) * 0.25,
  );

  return {
    ...base,
    confirmed,
    direction: confirmed ? setupDirection : null,
    momentum,
    quality,
  };
}

/**
 * MODE D — 1M precision trigger. Requires an aligned displacement candle (close
 * beyond the prior candle's extreme in the setup direction). Refines entry/stop.
 */
export function analyzePrecision(
  candles: Candle[],
  setupDirection: Direction | null,
  atrPeriod = 14,
): PrecisionAnalysis {
  const base: PrecisionAnalysis = {
    timeframe: '1m',
    triggered: false,
    direction: null,
    refinedEntry: null,
    refinedStop: null,
    quality: 0,
  };
  if (!setupDirection || candles.length < 2) return base;

  const last = candles[candles.length - 1]!;
  const prev = candles[candles.length - 2]!;
  const atr = latestAtr(candles, atrPeriod) ?? Math.abs(last.high - last.low);

  const wantBull = setupDirection === 'long';
  const displaced = wantBull ? last.close > prev.high : last.close < prev.low;
  const bodyRatio =
    Math.abs(last.close - last.open) / Math.max(last.high - last.low, 1e-9);

  const triggered = displaced && bodyRatio >= 0.5;
  const refinedEntry = last.close;
  const refinedStop = wantBull ? last.close - atr : last.close + atr;
  const quality = clamp01((displaced ? 0.6 : 0.2) + bodyRatio * 0.4);

  return {
    timeframe: '1m',
    triggered,
    direction: triggered ? setupDirection : null,
    refinedEntry: triggered ? refinedEntry : null,
    refinedStop: triggered ? refinedStop : null,
    quality,
  };
}
