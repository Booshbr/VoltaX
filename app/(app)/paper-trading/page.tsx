import { getDemoMarketView } from '@/lib/demo/dataset';
import { PageHeader, Disclaimer } from '@/components/page';
import { Card, CardTitle, Stat, Badge } from '@/components/ui';
import { SignalCard } from '@/components/signal-card';
import { formatMoney } from '@/lib/utils/format';

export const metadata = { title: 'Paper Trading — VoltaX' };

export default function PaperTradingPage() {
  const { evaluations, accountEquity } = getDemoMarketView();
  const qualified = evaluations.filter((e) => e.qualified);

  return (
    <>
      <PageHeader
        title="Paper Trading"
        subtitle="Simulated execution with the same signals, sizing and risk as live."
        actions={<Badge tone="accent">PAPER</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Stat label="Paper equity" value={formatMoney(accountEquity)} /></Card>
        <Card><Stat label="Open trades" value={0} /></Card>
        <Card><Stat label="Qualified signals" value={qualified.length} tone="accent" /></Card>
        <Card><Stat label="Realized P/L" value={formatMoney(0)} /></Card>
      </div>

      <section className="mt-6">
        <CardTitle hint="Paper mode">Qualified signals ready to paper trade</CardTitle>
        {qualified.length === 0 ? (
          <Card><p className="text-sm text-muted">No qualified setups right now.</p></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {qualified.slice(0, 6).map((e) => (
              <SignalCard key={e.instrumentSymbol} evaluation={e} />
            ))}
          </div>
        )}
      </section>
      <Disclaimer />
    </>
  );
}
