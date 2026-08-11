import { getMarketView } from '@/lib/market/source';
import { PageHeader, SourceBadge } from '@/components/page';
import { SignalCard } from '@/components/signal-card';

export const metadata = { title: 'Signals — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const { evaluations, source } = await getMarketView();
  const active = evaluations.filter((e) => e.direction !== null);

  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Qualified and developing setups across the scanned universe."
        actions={<SourceBadge source={source} />}
      />
      {active.length === 0 ? (
        <p className="text-sm text-muted">No directional setups right now.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {active.map((e) => (
            <SignalCard key={e.instrumentSymbol} evaluation={e} />
          ))}
        </div>
      )}
    </>
  );
}
