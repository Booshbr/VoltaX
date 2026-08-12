/**
 * In-app notification helpers (spec §28, §30). Pure builders + a new-vs-seen
 * selector so the client store only raises a notification once per distinct event
 * (no spam on every page refresh). Unit-tested.
 */
import type { AppNotification } from './index';

export interface StoredNotification extends AppNotification {
  id: string;
  /** Stable dedupe key for this event (e.g. one per qualified symbol+direction). */
  key: string;
  read: boolean;
  createdAt: string;
}

export interface QualifiedSignalInput {
  symbol: string;
  direction: 'long' | 'short';
  reliability: number;
  opportunityScore: number;
  riskReward: number;
}

/** Build the notification + dedupe key for a newly-qualified signal. */
export function buildQualifiedNotification(s: QualifiedSignalInput): {
  key: string;
  notification: AppNotification;
} {
  const dir = s.direction === 'long' ? 'BUY' : 'SELL';
  return {
    key: `qualified:${s.symbol}:${s.direction}`,
    notification: {
      kind: 'qualified_signal',
      title: `Qualified signal — ${s.symbol}`,
      body: `${dir} · reliability ${Math.round(s.reliability)}% · R:R 1:${s.riskReward.toFixed(1)} · opportunity ${s.opportunityScore}`,
    },
  };
}

/** From current qualified signals, return only those whose key hasn't been seen. */
export function selectNewQualified(
  current: QualifiedSignalInput[],
  seenKeys: Iterable<string>,
): { key: string; notification: AppNotification }[] {
  const seen = new Set(seenKeys);
  const out: { key: string; notification: AppNotification }[] = [];
  for (const s of current) {
    const built = buildQualifiedNotification(s);
    if (!seen.has(built.key)) out.push(built);
  }
  return out;
}
