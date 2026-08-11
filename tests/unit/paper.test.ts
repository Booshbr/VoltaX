import { describe, it, expect } from 'vitest';
import {
  createAccount,
  openTrade,
  pnlAt,
  levelHit,
  resolveTrade,
  markAccount,
  accountSummary,
  type OpenTradeInput,
} from '@/lib/trading/paper';

function mkInput(over: Partial<OpenTradeInput> = {}): OpenTradeInput {
  return {
    id: 't1',
    symbol: 'R_75',
    direction: 'long',
    size: 2,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    reliabilityAtEntry: 60,
    methodologyVersion: 'VOLTAX-METHOD-1.0.0',
    now: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('pnlAt', () => {
  it('computes long and short P/L with size and value', () => {
    const long = openTrade(mkInput());
    expect(pnlAt(long, 105)).toBe((105 - 100) * 1 * 2 * 1); // +10
    const short = openTrade(mkInput({ direction: 'short', stopLoss: 105, takeProfit: 90 }));
    expect(pnlAt(short, 95)).toBe((95 - 100) * -1 * 2 * 1); // +10
  });
});

describe('levelHit', () => {
  it('detects stop before tp for a long', () => {
    const t = openTrade(mkInput());
    expect(levelHit(t, 94)).toBe('stop');
    expect(levelHit(t, 111)).toBe('tp');
    expect(levelHit(t, 100)).toBeNull();
  });
  it('mirrors for a short', () => {
    const t = openTrade(mkInput({ direction: 'short', stopLoss: 105, takeProfit: 90 }));
    expect(levelHit(t, 106)).toBe('stop');
    expect(levelHit(t, 89)).toBe('tp');
  });
});

describe('resolveTrade', () => {
  it('closes a long as won at the take-profit price', () => {
    const t = openTrade(mkInput());
    const r = resolveTrade(t, 112, '2026-01-01T01:00:00Z');
    expect(r.status).toBe('won');
    expect(r.exitPrice).toBe(110); // filled at TP, not the overshoot
    expect(r.realizedPnl).toBe((110 - 100) * 2); // +20
  });
  it('closes a long as lost at the stop price', () => {
    const t = openTrade(mkInput());
    const r = resolveTrade(t, 90, '2026-01-01T01:00:00Z');
    expect(r.status).toBe('lost');
    expect(r.exitPrice).toBe(95);
    expect(r.realizedPnl).toBe((95 - 100) * 2); // -10
  });
  it('leaves an untouched trade open', () => {
    const t = openTrade(mkInput());
    expect(resolveTrade(t, 101, 'x').status).toBe('open');
  });
});

describe('accountSummary', () => {
  it('aggregates realised, unrealised, equity, win rate and drawdown', () => {
    const account = createAccount(10_000);
    // Two closed (one win +20, one loss -10) and one open marked +10.
    const won = resolveTrade(openTrade(mkInput({ id: 'a' })), 110, 't1');
    const lost = resolveTrade(
      openTrade(mkInput({ id: 'b', now: '2026-01-01T02:00:00Z' })),
      95,
      't2',
    );
    const open = openTrade(mkInput({ id: 'c' }));
    account.trades.push(won, lost, open);

    const s = accountSummary(account, { R_75: 105 });
    expect(s.realizedPnl).toBe(20 - 10); // +10
    expect(s.unrealizedPnl).toBe((105 - 100) * 2); // +10
    expect(s.equity).toBe(10_000 + 10 + 10);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.openCount).toBe(1);
    expect(s.maxDrawdown).toBeGreaterThanOrEqual(0);
  });
});

describe('markAccount', () => {
  it('auto-closes trades that hit levels and leaves others open', () => {
    const account = createAccount();
    account.trades.push(
      openTrade(mkInput({ id: 'a' })),
      openTrade(mkInput({ id: 'b', symbol: 'R_50', stopLoss: 95, takeProfit: 110 })),
    );
    const marked = markAccount(account, { R_75: 120, R_50: 101 }, 'now');
    expect(marked.trades.find((t) => t.id === 'a')!.status).toBe('won');
    expect(marked.trades.find((t) => t.id === 'b')!.status).toBe('open');
  });
});
