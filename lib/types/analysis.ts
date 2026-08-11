/**
 * Analytical output types for the four distinct modes (spec §4).
 * Modes are kept separate on purpose — they are never collapsed into one opaque
 * signal. The signal engine composes them explicitly (spec §5).
 */
import type { Timeframe } from './market';

export type Direction = 'long' | 'short';
export type Bias = 'bullish' | 'bearish' | 'neutral';

/** Market regime classification from higher-timeframe context. */
export type MarketRegime = 'trending' | 'ranging' | 'volatile' | 'compressed';

export type VolatilityCondition = 'low' | 'normal' | 'elevated' | 'abnormal';

/** A detected swing pivot in price structure. */
export interface SwingPoint {
  type: 'high' | 'low';
  index: number;
  time: number;
  price: number;
}

/** A support/resistance/supply/demand zone. */
export interface Zone {
  kind: 'support' | 'resistance' | 'supply' | 'demand';
  top: number;
  bottom: number;
  /** Candle index where the zone originated. */
  originIndex: number;
  /** How many times price reacted to the zone. */
  touches: number;
}

/** Break of Structure / Change of Character events. */
export interface StructureEvent {
  kind: 'BOS' | 'CHOCH';
  direction: Direction;
  index: number;
  time: number;
  /** The swing price level that was broken. */
  level: number;
}

/**
 * MODE A — Market Structure (4H / 1H). Establishes context (spec §4 Mode A).
 */
export interface MarketStructureAnalysis {
  timeframe: Timeframe;
  trend: Bias;
  regime: MarketRegime;
  bias: Bias;
  swings: SwingPoint[];
  events: StructureEvent[];
  zones: Zone[];
  volatility: VolatilityCondition;
  /** Price level that would invalidate the current structural read. */
  invalidationLevel: number | null;
  /** 0..1 quality of the structural read (clarity of trend/structure). */
  quality: number;
}

/** Setup lifecycle states (spec §4 Mode B). */
export type SetupStatus =
  | 'none'
  | 'forming'
  | 'qualified'
  | 'invalidated'
  | 'triggered'
  | 'expired';

/**
 * MODE B — Setup (15M) (spec §4 Mode B).
 */
export interface SetupAnalysis {
  timeframe: Timeframe;
  status: SetupStatus;
  direction: Direction | null;
  setupType: string | null;
  zone: Zone | null;
  triggerLevel: number | null;
  invalidationLevel: number | null;
  confluence: string[];
  /** 0..1 setup quality. */
  quality: number;
}

/**
 * MODE C — Entry confirmation (5M) (spec §4 Mode C).
 */
export interface EntryAnalysis {
  timeframe: Timeframe;
  confirmed: boolean;
  direction: Direction | null;
  localStructure: Bias;
  momentum: number;
  entryArea: number | null;
  invalidationLevel: number | null;
  /** 0..1 confirmation quality. */
  quality: number;
}

/**
 * MODE D — Precision entry (1M) (spec §4 Mode D).
 */
export interface PrecisionAnalysis {
  timeframe: Timeframe;
  triggered: boolean;
  direction: Direction | null;
  refinedEntry: number | null;
  refinedStop: number | null;
  /** 0..1 execution quality. */
  quality: number;
}
