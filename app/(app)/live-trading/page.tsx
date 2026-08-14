import { PageHeader, Disclaimer } from '@/components/page';
import { getLiveState } from '@/lib/trading/live-controller';
import { getDerivConfig } from '@/lib/deriv/config';
import { getDerivAccountSummary } from '@/lib/deriv/account';
import { getMarketView } from '@/lib/market/source';
import { LiveTradingDesk, type LiveSignal } from '@/components/live/live-trading-desk';

export const metadata = { title: 'Live Trading — VoltaX' };
export const dynamic = 'force-dynamic';

/** Live trading (spec §18, §42). Opt-in, multi-gated, with a prominent emergency
 * stop. Live execution requires an account token AND explicit enablement — never
 * automatic. */
export default async function LiveTradingPage() {
  const initialState = await getLiveState();
  const hasToken = getDerivConfig().hasAccount;
  const [{ evaluations }, account] = await Promise.all([getMarketView(), getDerivAccountSummary()]);

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
      <Disclaimer />
    </>
  );
}
