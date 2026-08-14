import { PageHeader, Disclaimer } from '@/components/page';
import { getLiveState } from '@/lib/trading/live-controller';
import { getDerivConfig } from '@/lib/deriv/config';
import type { DerivAccountSummary } from '@/lib/deriv/account';
import { getLiveRiskSnapshot } from '@/lib/deriv/positions';
import { getMarketView } from '@/lib/market/source';
import { evaluateGuardrails } from '@/lib/trading/guardrails';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';
import { LiveTradingDesk, type LiveSignal } from '@/components/live/live-trading-desk';
import { LiveRiskPanel } from '@/components/live/live-risk-panel';

export const metadata = { title: 'Live Trading — VoltaX' };
export const dynamic = 'force-dynamic';

/** Live trading (spec §18, §42). Opt-in, multi-gated, with a prominent emergency
 * stop, live risk guardrails and open-position management. */
export default async function LiveTradingPage() {
  const initialState = await getLiveState();
  const hasToken = getDerivConfig().hasAccount;
  const [{ evaluations }, snapshot] = await Promise.all([getMarketView(), getLiveRiskSnapshot()]);

  // Derive the account summary from the risk snapshot (one Deriv connection).
  const account: DerivAccountSummary = snapshot.connected
    ? { connected: true, balance: snapshot.balance, currency: snapshot.currency, isVirtual: snapshot.isVirtual }
    : { connected: false, error: snapshot.error };

  const risk = DEFAULT_STRATEGY.risk;
  const guardrails = evaluateGuardrails({
    equity: snapshot.balance,
    openStake: snapshot.openStake,
    openCount: snapshot.positions.length,
    dailyRealizedPnl: snapshot.dailyRealizedPnl,
    limits: { maxOpenRisk: risk.maxOpenRisk, maxDailyRisk: risk.maxDailyRisk, maxOpenTrades: risk.maxOpenTrades },
  });

  const signals: LiveSignal[] = evaluations
    .filter((e) => e.qualified && e.direction)
    .map((e) => ({
      symbol: e.instrumentSymbol,
      direction: e.direction as 'long' | 'short',
      reliability: e.reliability.score,
      opportunityScore: e.opportunityScore,
      riskReward: e.riskReward,
    }));

  return (
    <>
      <PageHeader
        title="Live Trading"
        subtitle="Opt-in real execution with independent safety layers. VoltaX never switches from paper to live automatically."
      />
      <LiveTradingDesk initialState={initialState} hasToken={hasToken} account={account} signals={signals} />
      <div className="mt-5">
        <LiveRiskPanel snapshot={snapshot} guardrails={guardrails} liveEnabled={initialState.enabled} />
      </div>
      <Disclaimer />
    </>
  );
}
