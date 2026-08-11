import Link from 'next/link';
import { getMarketView } from '@/lib/market/source';
import { PageHeader, SourceBadge } from '@/components/page';
import { Card } from '@/components/ui';
import { BiasBadge, VolatilityBadge } from '@/components/domain';
import { titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Markets — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function MarketsPage() {
  const { evaluations, source } = await getMarketView();
  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Every scanned instrument and its current higher-timeframe read."
        actions={<SourceBadge source={source} />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {evaluations.map((e) => (
          <Link key={e.instrumentSymbol} href={`/signals/${e.instrumentSymbol}`}>
            <Card className="transition-colors hover:border-accent/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">{e.instrumentSymbol}</span>
                <BiasBadge bias={e.htf.bias} />
              </div>
              <div className="mt-1 text-xs text-muted">{titleCase(e.family)} Indices</div>
              <div className="mt-3 flex items-center justify-between">
                <VolatilityBadge condition={e.htf.volatility} />
                <span className="tnum text-sm text-muted">Opp {e.opportunityScore}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
