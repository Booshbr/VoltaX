import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/signals/engine';
import {
  toSignalInsert,
  toReasonInserts,
  toInitialEventInsert,
} from '@/lib/supabase/repositories/signals';
import { uptrend, choppy, testInstrument } from '../helpers/candles';
import type { DataQualityStatus } from '@/lib/types';

const fresh: DataQualityStatus = { quality: 'healthy', lastUpdateMs: 0, issues: [] };

function directionalEval() {
  return evaluate({
    instrument: testInstrument,
    candles: { '4h': uptrend(12, 100, 6, '4h'), '1h': uptrend(12, 100, 6, '1h') },
    accountEquity: 10_000,
    feed: fresh,
    now: 1_000_000,
    sample: { wins: 55, losses: 25 },
  });
}

describe('toSignalInsert', () => {
  it('maps engine facts to a signals-table row without inventing values', () => {
    const e = directionalEval();
    const row = toSignalInsert(e, 'user-123');
    expect(row.user_id).toBe('user-123');
    expect(row.instrument_symbol).toBe(e.instrumentSymbol);
    expect(row.direction).toBe(e.direction);
    expect(row.entry_price).toBe(e.risk!.entry);
    expect(row.stop_loss).toBe(e.risk!.stopLoss);
    expect(row.risk_reward).toBe(e.riskReward);
    expect(row.reliability_score).toBe(e.reliability.score);
    expect(row.methodology_version).toBe(e.methodologyVersion);
  });

  it('throws for a non-directional evaluation (nothing to persist)', () => {
    const e = evaluate({
      instrument: testInstrument,
      candles: { '4h': choppy(), '1h': choppy(20, 100, '1h') },
      accountEquity: 10_000,
      feed: fresh,
      now: 1_000_000,
    });
    expect(() => toSignalInsert(e, 'u')).toThrow(/non-directional/i);
  });
});

describe('toReasonInserts', () => {
  it('carries every structured reason with its polarity', () => {
    const e = directionalEval();
    const rows = toReasonInserts(e, 'sig-1');
    expect(rows).toHaveLength(e.reasons.length);
    expect(rows.every((r) => r.signal_id === 'sig-1')).toBe(true);
    expect(rows.every((r) => r.polarity === 'supporting' || r.polarity === 'cautionary')).toBe(true);
  });
});

describe('toInitialEventInsert', () => {
  it('records the creation lifecycle event', () => {
    const e = directionalEval();
    const ev = toInitialEventInsert(e, 'sig-1');
    expect(ev.signal_id).toBe('sig-1');
    expect(ev.to_status).toBe(e.status);
    expect(ev.from_status).toBe('scanning');
  });
});
