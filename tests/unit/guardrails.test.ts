import { describe, it, expect } from 'vitest';
import { evaluateGuardrails, type GuardrailLimits } from '@/lib/trading/guardrails';

const limits: GuardrailLimits = { maxOpenRisk: 0.04, maxDailyRisk: 0.03, maxOpenTrades: 3 };

describe('evaluateGuardrails', () => {
  it('reports exposure and daily loss as fractions of equity', () => {
    const g = evaluateGuardrails({ equity: 1000, openRisk: 20, openCount: 1, dailyRealizedPnl: -15, limits });
    expect(g.exposurePct).toBeCloseTo(0.02, 5);
    expect(g.dailyLossPct).toBeCloseTo(0.015, 5);
    expect(g.anyBreached).toBe(false);
    expect(g.shouldAutoDisable).toBe(false);
  });

  it('flags a breach and auto-disable when the daily loss limit is hit', () => {
    const g = evaluateGuardrails({ equity: 1000, openRisk: 0, openCount: 0, dailyRealizedPnl: -30, limits });
    expect(g.dailyLossBreached).toBe(true);
    expect(g.anyBreached).toBe(true);
    expect(g.shouldAutoDisable).toBe(true);
  });

  it('flags exposure breach but not auto-disable (exposure alone does not disable)', () => {
    const g = evaluateGuardrails({ equity: 1000, openRisk: 45, openCount: 2, dailyRealizedPnl: 0, limits });
    expect(g.exposureBreached).toBe(true);
    expect(g.anyBreached).toBe(true);
    expect(g.shouldAutoDisable).toBe(false);
  });

  it('flags the open-position cap', () => {
    const g = evaluateGuardrails({ equity: 1000, openRisk: 10, openCount: 3, dailyRealizedPnl: 0, limits });
    expect(g.openCountBreached).toBe(true);
    expect(g.anyBreached).toBe(true);
  });

  it('ignores daily profit (only losses count toward the limit)', () => {
    const g = evaluateGuardrails({ equity: 1000, openRisk: 0, openCount: 0, dailyRealizedPnl: 500, limits });
    expect(g.dailyLossPct).toBe(0);
    expect(g.dailyLossBreached).toBe(false);
  });

  it('treats zero equity safely (no divide-by-zero)', () => {
    const g = evaluateGuardrails({ equity: 0, openRisk: 10, openCount: 1, dailyRealizedPnl: -5, limits });
    expect(g.exposurePct).toBe(0);
    expect(g.dailyLossPct).toBe(0);
  });
});
