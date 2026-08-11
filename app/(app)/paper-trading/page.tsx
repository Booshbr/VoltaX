import { getMarketView } from '@/lib/market/source';
import { METHODOLOGY_VERSION } from '@/lib/config/strategy';
import { PageHeader, Disclaimer, SourceBadge } from '@/components/page';
import { Badge } from '@/components/ui';
import { PaperDesk } from '@/components/paper/paper-desk';
import type { TradeableSignal } from '@/components/paper/types';

export const metadata = { title: 'Paper Trading — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function PaperTradingPage() {
  const { evaluations, source } = await getMarketView();

  // Price map for marking positions to market.
  const prices: Record<string, number> = {};
  for (const e of evaluations) {
    if (e.lastPrice !== null) prices[e.instrumentSymbol] = e.lastPrice;
  }

  // Tradeable = directional with a valid risk calc, take-profit and price.
  const signals: TradeableSignal[] = evaluations
    .filter((e) => e.direction && e.risk && e.risk.takeProfits[0] && e.lastPrice !== null && e.risk.size > 0)
    .map((e) => ({
      symbol: e.instrumentSymbol,
      family: e.family,
      direction: e.direction!,
      entry: e.risk!.entry,
      stop: e.risk!.stopLoss,
      takeProfit: e.risk!.takeProfits[0]!.price,
      size: e.risk!.size,
      reliability: e.reliability.score,
      opportunityScore: e.opportunityScore,
      lastPrice: e.lastPrice!,
      qualified: e.qualified,
    }))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.opportunityScore - a.opportunityScore);

  return (
    <>
      <PageHeader
        title="Paper Trading"
        subtitle="Simulated execution with the same signals, sizing and risk as live. Positions are marked against the latest prices."
        actions={
          <div className="flex items-center gap-2">
            <SourceBadge source={source} />
            <Badge tone="accent">PAPER</Badge>
          </div>
        }
      />
      <PaperDesk signals={signals} prices={prices} methodologyVersion={METHODOLOGY_VERSION} />
      <Disclaimer />
    </>
  );
}
