/**
 * Data-quality subsystem (spec §40). Classifies feed freshness so the signal
 * engine can refuse to generate signals on stale data (spec §39 "If the data
 * feed becomes stale: DO NOT GENERATE NEW TRADING SIGNALS").
 */
import type { Candle, DataQualityStatus, Timeframe } from '@/lib/types';
import { detectGaps } from './candles';

export interface QualityThresholds {
  /** Below this age (ms) the feed is healthy. */
  healthyMs: number;
  /** Below this age (ms) the feed is delayed; at/above it is stale. */
  delayedMs: number;
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  healthyMs: 5_000,
  delayedMs: 15_000,
};

/**
 * Assess feed quality from the age of the last update and structural checks on
 * the recent candle series.
 */
export function assessFeed(
  lastUpdateMs: number,
  recentCandles: Candle[],
  tf: Timeframe,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS,
): DataQualityStatus {
  const issues: string[] = [];

  const gaps = detectGaps(recentCandles, tf);
  if (gaps.length > 0) issues.push(`${gaps.length} missing candle(s) detected`);

  let quality: DataQualityStatus['quality'];
  if (!Number.isFinite(lastUpdateMs)) {
    quality = 'unknown';
    issues.push('No update timestamp available');
  } else if (lastUpdateMs < thresholds.healthyMs) {
    quality = 'healthy';
  } else if (lastUpdateMs < thresholds.delayedMs) {
    quality = 'delayed';
    issues.push(`Feed delayed: ${Math.round(lastUpdateMs / 1000)}s since last update`);
  } else {
    quality = 'stale';
    issues.push(`Feed stale: ${Math.round(lastUpdateMs / 1000)}s since last update`);
  }

  return { quality, lastUpdateMs, issues };
}

/** Gate used by the signal engine: only fresh feeds may produce new signals. */
export function feedAllowsSignals(status: DataQualityStatus): boolean {
  return status.quality === 'healthy' || status.quality === 'delayed';
}
