/**
 * Signal-outcome resolution (spec §2, §26). Deterministic and look-ahead-safe:
 * a qualified signal is resolved ONLY against candles that open strictly after the
 * decision time, and if a single candle straddles both the stop and the target we
 * count the STOP — never overstate a win (spec §2 no guaranteed-profit, §4 fail-safe).
 *
 * This turns "historical reliability" into evidence from real signals instead of
 * theory: the aggregate win-rate uses the same Wilson lower bound as the engine.
 */
import type { Candle } from '@/lib/types';
import { wilsonLowerBound } from '@/lib/signals/reliability';

export type OutcomeStatus = 'pending' | 'win' | 'loss' | 'expired';

export interface OpenSignal {
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  /** First take-profit — the target used to declare a win. */
  takeProfit: number;
  /** Decision time, unix seconds. Only later candles are evaluated. */
  createdAtSec: number;
}

export interface OutcomeResolution {
  status: OutcomeStatus;
  price: number | null;
  resolvedAtSec: number | null;
  barsToResolve: number | null;
}

export interface ResolveOptions {
  /** Mark 'expired' if unresolved and the newest candle is older than this many
   * seconds past the decision time. Omit to keep an unresolved signal 'pending'. */
  maxHorizonSec?: number;
}

/**
 * Resolve one signal against forward price action. Candles may be unsorted; only
 * those opening strictly after `createdAtSec` are considered.
 */
export function resolveOutcome(signal: OpenSignal, candles: Candle[], opts: ResolveOptions = {}): OutcomeResolution {
  const forward = candles
    .filter((c) => c.time > signal.createdAtSec)
    .sort((a, b) => a.time - b.time);

  let bars = 0;
  for (const c of forward) {
    bars += 1;
    const hitStop = signal.direction === 'long' ? c.low <= signal.stopLoss : c.high >= signal.stopLoss;
    const hitTarget = signal.direction === 'long' ? c.high >= signal.takeProfit : c.low <= signal.takeProfit;
    // Conservative tie-break: a bar touching both is a loss, never a win.
    if (hitStop) return { status: 'loss', price: signal.stopLoss, resolvedAtSec: c.time, barsToResolve: bars };
    if (hitTarget) return { status: 'win', price: signal.takeProfit, resolvedAtSec: c.time, barsToResolve: bars };
  }

  if (opts.maxHorizonSec && forward.length) {
    const last = forward[forward.length - 1]!;
    if (last.time - signal.createdAtSec >= opts.maxHorizonSec) {
      return { status: 'expired', price: last.close, resolvedAtSec: last.time, barsToResolve: forward.length };
    }
  }
  return { status: 'pending', price: null, resolvedAtSec: null, barsToResolve: null };
}

// ---------------------------------------------------------------------------
// Aggregation — pure, so the Performance page and its tests share one source.
// ---------------------------------------------------------------------------

export interface OutcomeRecord {
  status: OutcomeStatus;
  family: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

export interface OutcomeStat {
  /** win + loss (expired excluded — no directional result). */
  decided: number;
  wins: number;
  losses: number;
  expired: number;
  /** Raw hit rate over decided signals (0..1), or null when none decided. */
  winRate: number | null;
  /** Conservative Wilson lower bound (0..1), or null when none decided. */
  wilsonLower: number | null;
  /** Mean realised R across win + loss + expired (win = TP/SL ratio, loss = -1, expired = 0). */
  expectancyR: number;
}

export interface OutcomeStats extends OutcomeStat {
  total: number;
  pending: number;
  families: Array<{ family: string } & OutcomeStat>;
}

/** Realised R for a resolved record. Wins earn the target's reward-per-risk. */
function realisedR(r: OutcomeRecord): number {
  if (r.status === 'win') {
    const risk = Math.abs(r.entry - r.stopLoss);
    return risk > 0 ? Math.abs(r.takeProfit - r.entry) / risk : 0;
  }
  if (r.status === 'loss') return -1;
  return 0; // expired = scratch
}

function statFor(records: OutcomeRecord[]): OutcomeStat {
  const wins = records.filter((r) => r.status === 'win').length;
  const losses = records.filter((r) => r.status === 'loss').length;
  const expired = records.filter((r) => r.status === 'expired').length;
  const decided = wins + losses;
  const resolved = decided + expired;
  const expectancyR = resolved > 0 ? records.reduce((sum, r) => sum + realisedR(r), 0) / resolved : 0;
  return {
    decided,
    wins,
    losses,
    expired,
    winRate: decided > 0 ? wins / decided : null,
    wilsonLower: decided > 0 ? wilsonLowerBound(wins, decided) : null,
    expectancyR,
  };
}

/** Aggregate resolved+pending outcome rows into overall and per-family stats. */
export function aggregateOutcomes(rows: Array<OutcomeRecord & { status: OutcomeStatus }>): OutcomeStats {
  const resolved = rows.filter((r) => r.status !== 'pending');
  const overall = statFor(resolved);
  const families = new Map<string, OutcomeRecord[]>();
  for (const r of resolved) {
    const list = families.get(r.family) ?? [];
    list.push(r);
    families.set(r.family, list);
  }
  return {
    ...overall,
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    families: [...families.entries()]
      .map(([family, list]) => ({ family, ...statFor(list) }))
      .sort((a, b) => b.decided - a.decided),
  };
}
