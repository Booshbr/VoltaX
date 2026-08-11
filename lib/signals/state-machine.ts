/**
 * Signal lifecycle state machine (spec §12). Transitions are explicit and
 * validated; history is never silently overwritten — each transition yields an
 * immutable SignalEvent to be appended to the signal's event log.
 */
import type { SignalEvent, SignalStatus } from '@/lib/types';

/** Allowed transitions. Any transition not listed here is rejected. */
const TRANSITIONS: Record<SignalStatus, SignalStatus[]> = {
  scanning: ['developing', 'cancelled'],
  developing: ['qualified', 'invalidated', 'expired', 'cancelled'],
  qualified: ['active', 'invalidated', 'expired', 'cancelled'],
  active: ['tp1', 'stopped', 'invalidated'],
  tp1: ['tp2', 'stopped', 'completed'],
  tp2: ['completed', 'stopped'],
  completed: [],
  stopped: [],
  invalidated: [],
  expired: [],
  cancelled: [],
};

/** Terminal states never transition again. */
export const TERMINAL_STATES: readonly SignalStatus[] = [
  'completed',
  'stopped',
  'invalidated',
  'expired',
  'cancelled',
];

export function isTerminal(status: SignalStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

export function canTransition(from: SignalStatus, to: SignalStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

let eventSeq = 0;

/**
 * Attempt a transition. Returns the SignalEvent on success or throws on an
 * illegal transition — callers must handle terminal/invalid states explicitly.
 */
export function transition(
  signalId: string,
  from: SignalStatus,
  to: SignalStatus,
  opts: { price?: number | null; note?: string; now?: () => string } = {},
): SignalEvent {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal signal transition: ${from} → ${to}`);
  }
  const createdAt = opts.now ? opts.now() : new Date().toISOString();
  return {
    id: `evt_${++eventSeq}_${createdAt}`,
    signalId,
    from,
    to,
    price: opts.price ?? null,
    note: opts.note ?? '',
    createdAt,
  };
}
