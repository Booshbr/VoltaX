/**
 * Live risk snapshot for client widgets (e.g. the dashboard exposure meter).
 * Requires an authenticated session (the proxy gates it). Read-only — never trades.
 */
import { NextResponse } from 'next/server';
import { getLiveRiskSnapshot } from '@/lib/deriv/positions';
import { evaluateGuardrails } from '@/lib/trading/guardrails';
import { getUserRiskSettings } from '@/lib/supabase/repositories/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function GET() {
  const [snapshot, risk] = await Promise.all([getLiveRiskSnapshot(), getUserRiskSettings()]);
  if (!snapshot.connected) return NextResponse.json({ connected: false });

  const g = evaluateGuardrails({
    equity: snapshot.balance,
    openRisk: snapshot.openRisk,
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
