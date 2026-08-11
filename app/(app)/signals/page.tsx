import { getDemoMarketView } from '@/lib/demo/dataset';
import { PageHeader } from '@/components/page';
import { SignalCard } from '@/components/signal-card';

export const metadata = { title: 'Signals — VoltaX' };

export default function SignalsPage() {
  const { evaluations } = getDemoMarketView();
  const active = evaluations.filter((e) => e.direction !== null);

  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Qualified and developing setups across the scanned universe."
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
