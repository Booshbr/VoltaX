/**
 * Signal domain model (spec §11, §12). A signal is an immutable historical record;
 * state changes are captured as events, never by silently overwriting history.
 */
import type { IndexFamily } from './market';
import type {
  Direction,
  MarketStructureAnalysis,
  SetupAnalysis,
  EntryAnalysis,
  PrecisionAnalysis,
} from './analysis';
import type { TakeProfit } from './risk';

/** Which analytical mode the signal reached (spec §11 mode). */
export type SignalMode = 'structure' | 'setup' | 'entry' | 'precision';

/** Signal lifecycle states (spec §12). */
export type SignalStatus =
  | 'scanning'
  | 'developing'
  | 'qualified'
  | 'active'
  | 'tp1'
  | 'tp2'
  | 'completed'
  | 'stopped'
  | 'invalidated'
  | 'expired'
  | 'cancelled';

/** A single structured, human-readable reason (spec §3, never hallucinated). */
export interface SignalReason {
  category: 'structure' | 'setup' | 'entry' | 'precision' | 'risk' | 'statistics';
  /** Short machine-stable code, e.g. "htf_trend_aligned". */
  code: string;
  /** Human-readable explanation derived from structured data. */
  text: string;
  /** Whether this reason counts for or against the setup. */
  polarity: 'supporting' | 'cautionary';
}

/** Snapshot of higher-timeframe context attached to a signal. */
export interface MarketContext {
  htf: MarketStructureAnalysis;
  mtf: MarketStructureAnalysis;
}

export interface SetupContext {
  setup: SetupAnalysis;
}

export interface EntryContext {
  entry: EntryAnalysis;
  precision: PrecisionAnalysis;
}

export interface RiskContext {
  entry: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  riskReward: number;
}

/**
 * Immutable historical signal record. Once persisted, the row is never mutated —
 * lifecycle changes are recorded as SignalEvents (spec §11 immutability).
 */
export interface Signal {
  id: string;
  instrumentSymbol: string;
  instrumentFamily: IndexFamily;
  direction: Direction;
  mode: SignalMode;
  status: SignalStatus;

  entryPrice: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  riskReward: number;

  /** 0..100 statistical reliability (spec §14). NOT a probability of profit. */
  reliabilityScore: number;
  /** 0..100 composite opportunity ranking score (spec §13). */
  opportunityScore: number;

  methodologyVersion: string;
  createdAt: string;
  updatedAt: string;

  reasons: SignalReason[];
  marketContext: MarketContext;
  setupContext: SetupContext;
  entryContext: EntryContext;
  riskContext: RiskContext;
}

/** An immutable lifecycle transition for a signal (spec §12 "record transitions"). */
export interface SignalEvent {
  id: string;
  signalId: string;
  from: SignalStatus;
  to: SignalStatus;
  price: number | null;
  note: string;
  createdAt: string;
}
