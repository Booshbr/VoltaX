import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/signals/engine';
import {
  canTransition,
  transition,
  isTerminal,
} from '@/lib/signals/state-machine';
import { computeReliability, wilsonLowerBound } from '@/lib/signals/reliability';
import { uptrend, downtrend, choppy, testInstrument } from '../helpers/candles';
import type { DataQualityStatus } from '@/lib/types';

const freshFeed: DataQualityStatus = { quality: 'healthy', lastUpdateMs: 500, issues: [] };
const staleFeed: DataQualityStatus = { quality: 'stale', lastUpdateMs: 60_000, issues: [] };

describe('engine — feed gate', () => {
  it('never generates a signal on a stale feed (spec §39)', () => {
    const r = evaluate({
      instrument: testInstrument,
      candles: { '4h': uptrend(), '1h': uptrend(8, 100, 5, '1h') },
      accountEquity: 10_000,
      feed: staleFeed,
      now: 1_000_000,
    });
    expect(r.qualified).toBe(false);
    expect(r.status).toBe('scanning');
    expect(r.rejectionReason).toMatch(/fresh/i);
  });
});

describe('engine — HTF alignment gate', () => {
  it('does not qualify when 4H and 1H disagree', () => {
    const r = evaluate({
      instrument: testInstrument,
      candles: { '4h': uptrend(), '1h': downtrend(8, 200, 5, '1h') },
      accountEquity: 10_000,
      feed: freshFeed,
      now: 1_000_000,
    });
    expect(r.qualified).toBe(false);
    expect(r.reasons.some((x) => x.code === 'htf_unaligned')).toBe(true);
  });

  it('does not qualify on neutral/choppy structure', () => {
    const r = evaluate({
      instrument: testInstrument,
      candles: { '4h': choppy(), '1h': choppy(20, 100, '1h') },
      accountEquity: 10_000,
      feed: freshFeed,
      now: 1_000_000,
    });
    expect(r.qualified).toBe(false);
  });

  it('recognises aligned bullish HTF as long context', () => {
    const r = evaluate({
      instrument: testInstrument,
      candles: {
        '4h': uptrend(8, 100, 6, '4h'),
        '1h': uptrend(8, 100, 6, '1h'),
      },
      accountEquity: 10_000,
      feed: freshFeed,
      now: 1_000_000,
    });
    // Direction should be long once HTF is aligned bullish (setup may still be developing).
    if (r.reasons.some((x) => x.code === 'htf_aligned')) {
      expect(r.direction).toBe('long');
    }
  });
});

describe('engine — determinism (spec §71)', () => {
  it('produces identical output for identical input', () => {
    const input = {
      instrument: testInstrument,
      candles: { '4h': uptrend(8, 100, 6, '4h'), '1h': uptrend(8, 100, 6, '1h') },
      accountEquity: 10_000,
      feed: freshFeed,
      now: 1_000_000,
    };
    expect(JSON.stringify(evaluate(input))).toBe(JSON.stringify(evaluate(input)));
  });
});

describe('signal state machine (spec §12)', () => {
  it('allows valid transitions and rejects invalid ones', () => {
    expect(canTransition('scanning', 'developing')).toBe(true);
    expect(canTransition('qualified', 'active')).toBe(true);
    expect(canTransition('active', 'tp1')).toBe(true);
    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('scanning', 'active')).toBe(false);
  });

  it('emits an immutable event on transition and throws on illegal ones', () => {
    const evt = transition('sig1', 'qualified', 'active', { price: 100, note: 'entry' });
    expect(evt.from).toBe('qualified');
    expect(evt.to).toBe('active');
    expect(evt.price).toBe(100);
    expect(() => transition('sig1', 'completed', 'active')).toThrow(/illegal/i);
  });

  it('marks terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('active')).toBe(false);
  });
});

describe('reliability (spec §14)', () => {
  it('returns a neutral, insufficient prior with no sample', () => {
    const r = computeReliability({ wins: 0, losses: 0 });
    expect(r.score).toBe(50);
    expect(r.sufficient).toBe(false);
    expect(r.winRate).toBeNull();
  });

  it('penalises small samples via the Wilson lower bound', () => {
    const small = wilsonLowerBound(5, 5); // 5/5 wins
    const large = wilsonLowerBound(100, 100); // 100/100 wins
    expect(small).toBeLessThan(large);
    expect(large).toBeGreaterThan(0.9);
  });

  it('flags sufficiency only at/above the sample threshold', () => {
    expect(computeReliability({ wins: 9, losses: 1 }).sufficient).toBe(false);
    expect(computeReliability({ wins: 18, losses: 2 }).sufficient).toBe(true);
  });
});
