/**
 * Market-data domain types (spec §9, §3).
 * These are the raw inputs every analytical layer consumes.
 */

/** Supported analysis timeframes, ordered from fastest to slowest. */
export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/** Timeframe duration in seconds — the single source of truth for aggregation. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
};

/**
 * A single OHLC candle. `time` is the candle OPEN time in Unix seconds (UTC).
 * `volume` is optional: Deriv synthetic indices do not expose real volume, and we
 * never invent it (spec §6 "Never invent volume data").
 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** A raw tick from the data feed. */
export interface Tick {
  time: number;
  price: number;
}

/**
 * Deriv synthetic-index families. This enum is a classification aid only — the
 * live instrument universe is discovered from the API, never hard-coded as
 * exhaustive (spec §7 "dynamically discover instruments").
 */
export type IndexFamily =
  | 'volatility'
  | 'boom'
  | 'crash'
  | 'jump'
  | 'step'
  | 'range-break'
  | 'drift-switch'
  | 'unknown';

/** A tradable instrument as discovered from the data provider. */
export interface Instrument {
  /** Provider symbol, e.g. "R_75", "BOOM500". */
  symbol: string;
  /** Human display name, e.g. "Volatility 75 Index". */
  displayName: string;
  family: IndexFamily;
  /** Smallest price increment, from provider metadata (pip size). */
  pip: number;
  /** Whether the instrument is currently open for trading/streaming. */
  active: boolean;
}

/** Freshness classification for a data feed (spec §40). */
export type DataQuality = 'healthy' | 'delayed' | 'stale' | 'unknown';

export interface DataQualityStatus {
  quality: DataQuality;
  /** Milliseconds since the last accepted update. */
  lastUpdateMs: number;
  issues: string[];
}
