import { describe, it, expect } from 'vitest';
import { evaluateLiveExecution, type LiveExecutionContext } from '@/lib/trading/live-safety';
import type { EngineEvaluation } from '@/lib/signals/engine';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';
import { initialGuardState } from '@/lib/trading/risk';
import { testInstrument } from '../helpers/candles';
import type { DataQualityStatus } from '@/lib/types';

const fresh: DataQualityStatus = { quality: 'healthy', lastUpdateMs: 200, issues: [] };
const stale: DataQualityStatus = { quality: 'stale', lastUpdateMs: 60_000, issues: [] };

/** Minimal evaluation stub — the safety pipeline only reads qualified/direction/
 * risk(null?)/status, so we test it in isolation without the engine. */
function evalStub(qualified: boolean): EngineEvaluation {
  return {
    qualified,
    direction: qualified ? 'long' : null,
    risk: qualified ? { entry: 100, stopLoss: 95, takeProfits: [{ level: 1, price: 110 }] } : null,
    status: qualified ? 'qualified' : 'scanning',
  } as unknown as EngineEvaluation;
}

/** A fully-passing context we then break one gate at a time. */
function baseContext(over: Partial<LiveExecutionContext> = {}): LiveExecutionContext {
  return {
    evaluation: evalStub(true),
    instrument: testInstrument,
    feed: fresh,
    live: { enabled: true, emergencyStop: false, accountConnected: true, accountAuthorized: true },
    risk: {
      config: DEFAULT_STRATEGY.risk,
      guard: initialGuardState(),
      openPositions: 0,
      stake: 100,
      riskAmount: 100,
      minStake: 1,
      maxStake: 1000,
      accountEquity: 10_000,
    },
    confirmed: true,
    ...over,
  };
}

describe('evaluateLiveExecution — all gates must pass', () => {
  it('approves only when every gate passes', () => {
    const res = evaluateLiveExecution(baseContext());
    expect(res.approved).toBe(true);
    expect(res.rejectionReasons).toHaveLength(0);
    expect(res.checks).toHaveLength(10);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it('blocks when live trading is not enabled', () => {
    const res = evaluateLiveExecution(
      baseContext({ live: { enabled: false, emergencyStop: false, accountConnected: true, accountAuthorized: true } }),
    );
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Live trading enabled/i);
  });

  it('blocks when the emergency stop is active', () => {
    const res = evaluateLiveExecution(
      baseContext({ live: { enabled: true, emergencyStop: true, accountConnected: true, accountAuthorized: true } }),
    );
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Emergency stop/i);
  });

  it('blocks when the account is not connected/authorized', () => {
    const res = evaluateLiveExecution(
      baseContext({ live: { enabled: true, emergencyStop: false, accountConnected: false, accountAuthorized: false } }),
    );
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Account connected/i);
  });

  it('blocks on a stale feed', () => {
    const res = evaluateLiveExecution(baseContext({ feed: stale }));
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Market data fresh/i);
  });

  it('blocks when the signal is not qualified', () => {
    const res = evaluateLiveExecution(baseContext({ evaluation: evalStub(false) }));
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Signal still valid/i);
  });

  it('blocks when the daily risk limit would be exceeded', () => {
    const guard = { ...initialGuardState(), dailyRiskUsed: DEFAULT_STRATEGY.risk.maxDailyRisk };
    const ctx = baseContext();
    const res = evaluateLiveExecution({ ...ctx, risk: { ...ctx.risk, guard } });
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Risk limits valid/i);
  });

  it('blocks when the max open-position limit is reached', () => {
    const ctx = baseContext();
    const res = evaluateLiveExecution({
      ...ctx,
      risk: { ...ctx.risk, openPositions: DEFAULT_STRATEGY.risk.maxOpenTrades },
    });
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Position limit/i);
  });

  it('blocks when the stake is outside instrument bounds', () => {
    const ctx = baseContext();
    const res = evaluateLiveExecution({ ...ctx, risk: { ...ctx.risk, stake: 5000 } });
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Stake valid/i);
  });

  it('measures risk by the stop-loss, not the full deposit stake (small account + multiplier)', () => {
    // $10 balance with the $1 Deriv minimum stake is ~10% of equity, but the
    // monetary stop-loss caps the loss at ~$0.10 (~1%) — within the 3%/4% limits.
    const ctx = baseContext();
    const res = evaluateLiveExecution({
      ...ctx,
      risk: { ...ctx.risk, accountEquity: 10, stake: 1, riskAmount: 0.1, minStake: 1, maxStake: 10 },
    });
    const riskCheck = res.checks.find((c) => c.name === 'Risk limits valid');
    expect(riskCheck?.passed).toBe(true);
  });

  it('blocks without explicit per-trade confirmation', () => {
    const res = evaluateLiveExecution(baseContext({ confirmed: false }));
    expect(res.approved).toBe(false);
    expect(res.rejectionReasons.join(' ')).toMatch(/Trade confirmed/i);
  });
});
