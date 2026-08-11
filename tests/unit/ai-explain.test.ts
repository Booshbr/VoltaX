import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/signals/engine';
import { buildExplanationContext } from '@/lib/ai/context';
import { explainDeterministic } from '@/lib/ai/deterministic';
import { explainSignal } from '@/lib/ai/explain';
import { uptrend, downtrend, choppy, testInstrument } from '../helpers/candles';
import type { DataQualityStatus } from '@/lib/types';

const fresh: DataQualityStatus = { quality: 'healthy', lastUpdateMs: 500, issues: [] };

function evalUptrend() {
  return evaluate({
    instrument: testInstrument,
    candles: { '4h': uptrend(10, 100, 6, '4h'), '1h': uptrend(10, 100, 6, '1h') },
    accountEquity: 10_000,
    feed: fresh,
    now: 1_000_000,
    sample: { wins: 60, losses: 20 },
  });
}

describe('buildExplanationContext', () => {
  it('copies only validated facts, inventing nothing', () => {
    const e = evalUptrend();
    const ctx = buildExplanationContext(e);
    expect(ctx.instrument).toBe(e.instrumentSymbol);
    expect(ctx.reliability.score).toBe(e.reliability.score);
    expect(ctx.opportunityScore).toBe(e.opportunityScore);
    // risk mirrors the engine's risk exactly (no fabricated numbers)
    if (e.risk) {
      expect(ctx.risk?.entry).toBe(e.risk.entry);
      expect(ctx.risk?.riskReward).toBe(e.risk.riskReward);
    }
  });
});

describe('explainDeterministic', () => {
  it('produces all explanation fields', () => {
    const ex = explainDeterministic(buildExplanationContext(evalUptrend()));
    for (const key of ['summary', 'structure', 'setup', 'entry', 'risk', 'reliability', 'invalidation'] as const) {
      expect(typeof ex[key]).toBe('string');
      expect(ex[key].length).toBeGreaterThan(0);
    }
    expect(ex.source).toBe('deterministic');
  });

  it('never uses guaranteed-profit language (spec §2)', () => {
    const ex = explainDeterministic(buildExplanationContext(evalUptrend()));
    const blob = Object.values(ex).join(' ').toLowerCase();
    for (const banned of ['guaranteed', 'risk-free', 'certain to', 'will win']) {
      expect(blob).not.toContain(banned);
    }
  });

  it('explains a non-qualified setup honestly', () => {
    const e = evaluate({
      instrument: testInstrument,
      candles: { '4h': choppy(), '1h': downtrend(8, 200, 5, '1h') },
      accountEquity: 10_000,
      feed: fresh,
      now: 1_000_000,
    });
    const ex = explainSignal(e);
    expect(ex.summary.toLowerCase()).toMatch(/not a qualified|scanning|developing/);
  });

  it('is deterministic for identical input', () => {
    const a = explainSignal(evalUptrend());
    const b = explainSignal(evalUptrend());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
