import { describe, it, expect } from 'vitest';
import {
  calculatePosition,
  computeRiskReward,
  initialGuardState,
} from '@/lib/trading/risk';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';

const risk = DEFAULT_STRATEGY.risk;

describe('computeRiskReward', () => {
  it('computes R:R to the first take-profit', () => {
    // long: entry 100, stop 96 (risk 4), tp 112 (reward 12) => 3.0
    const rr = computeRiskReward('long', 100, 96, [{ level: 1, price: 112 }]);
    expect(rr).toBeCloseTo(3.0);
  });
  it('returns 0 with no take-profit or zero stop distance', () => {
    expect(computeRiskReward('long', 100, 100, [{ level: 1, price: 110 }])).toBe(0);
    expect(computeRiskReward('long', 100, 96, [])).toBe(0);
  });
});

describe('calculatePosition', () => {
  it('sizes by risk fraction and stop distance', () => {
    const calc = calculatePosition(
      {
        direction: 'long',
        entry: 100,
        stopLoss: 95,
        takeProfits: [{ level: 1, price: 115 }],
        accountEquity: 10_000,
        valuePerPricePerUnit: 1,
      },
      risk,
    );
    // riskAmount = 10000 * 0.01 = 100; size = 100 / (5 * 1) = 20
    expect(calc.rejected).toBe(false);
    expect(calc.riskAmount).toBe(100);
    expect(calc.size).toBe(20);
    expect(calc.riskReward).toBeCloseTo(3.0);
  });

  it('rejects inverted long geometry (stop above entry)', () => {
    const calc = calculatePosition(
      {
        direction: 'long',
        entry: 100,
        stopLoss: 105,
        takeProfits: [{ level: 1, price: 115 }],
        accountEquity: 10_000,
      },
      risk,
    );
    expect(calc.rejected).toBe(true);
    expect(calc.rejectionReasons.join(' ')).toMatch(/stop must be below/i);
  });

  it('rejects when the emergency stop has halted trading', () => {
    const guard = { ...initialGuardState(), tradingHalted: true };
    const calc = calculatePosition(
      {
        direction: 'short',
        entry: 100,
        stopLoss: 104,
        takeProfits: [{ level: 1, price: 90 }],
        accountEquity: 10_000,
      },
      risk,
      guard,
    );
    expect(calc.rejected).toBe(true);
    expect(calc.rejectionReasons.join(' ')).toMatch(/halted/i);
  });

  it('rejects when the daily risk limit would be exceeded', () => {
    const guard = { ...initialGuardState(), dailyRiskUsed: risk.maxDailyRisk };
    const calc = calculatePosition(
      {
        direction: 'long',
        entry: 100,
        stopLoss: 95,
        takeProfits: [{ level: 1, price: 115 }],
        accountEquity: 10_000,
      },
      risk,
      guard,
    );
    expect(calc.rejected).toBe(true);
    expect(calc.rejectionReasons.join(' ')).toMatch(/daily risk/i);
  });

  it('clamps size to the instrument maximum', () => {
    const calc = calculatePosition(
      {
        direction: 'long',
        entry: 100,
        stopLoss: 99,
        takeProfits: [{ level: 1, price: 110 }],
        accountEquity: 100_000,
        maxSize: 50,
      },
      risk,
    );
    expect(calc.size).toBe(50);
  });
});
