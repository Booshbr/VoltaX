/**
 * Live risk snapshot for client widgets (e.g. the dashboard exposure meter).
 * Requires an authenticated session (the proxy gates it). Read-only — never trades.
 */
import { NextResponse } from 'next/server';
import { getLiveRiskSnapshot } from '@/lib/deriv/positions';
import { evaluateGuardrails } from '@/lib/trading/guardrails';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getLiveRiskSnapshot();
  if (!snapshot.connected) return NextResponse.json({ connected: false });

  const risk = DEFAULT_STRATEGY.risk;
  const g = evaluateGuardrails({
    equity: snapshot.balance,
    openStake: snapshot.openStake,
    openCount: snapshot.positions.length,
    dailyRealizedPnl: snapshot.dailyRealizedPnl,
    limits: { maxOpenRisk: risk.maxOpenRisk, maxDailyRisk: risk.maxDailyRisk, maxOpenTrades: risk.maxOpenTrades },
  });

  return NextResponse.json({
    connected: true,
    isVirtual: snapshot.isVirtual,
    currency: snapshot.currency,
    dailyRealizedPnl: snapshot.dailyRealizedPnl,
    exposurePct: g.exposurePct,
    exposureLimitPct: g.exposureLimitPct,
    dailyLossPct: g.dailyLossPct,
    dailyLossLimitPct: g.dailyLossLimitPct,
    openCount: g.openCount,
    maxOpenTrades: g.maxOpenTrades,
    anyBreached: g.anyBreached,
  });
}
