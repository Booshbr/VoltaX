import { getDemoMarketView } from '@/lib/demo/dataset';
import { PageHeader, Disclaimer } from '@/components/page';
import { Card, CardTitle, Stat, Dot } from '@/components/ui';
import { SignalCard } from '@/components/signal-card';
import { formatMoney } from '@/lib/utils/format';

export default function DashboardPage() {
  const view = getDemoMarketView();
  const { summary, evaluations, feed } = view;

  const qualified = evaluations.filter((e) => e.qualified);
  const top = (qualified.length ? qualified : evaluations).slice(0, 3);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What the market is doing, the best current opportunities, and system health."
      />

      {/* Market overview (spec §22) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card><Stat label="Scanned" value={summary.scanned} /></Card>
        <Card><Stat label="Bullish" value={summary.bullish} tone="bull" /></Card>
        <Card><Stat label="Bearish" value={summary.bearish} tone="bear" /></Card>
        <Card><Stat label="Neutral" value={summary.neutral} tone="default" /></Card>
        <Card><Stat label="Developing" value={summary.developing} tone="warn" /></Card>
        <Card><Stat label="Qualified" value={summary.qualified} tone="accent" /></Card>
      </div>

      {/* Top opportunities (spec §22) */}
      <section className="mt-6">
        <CardTitle hint="Ranked by opportunity score">Top opportunities</CardTitle>
        {top.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No qualified setups right now. That is a valid result — VoltaX does not
              manufacture signals to look busy.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((e) => (
              <SignalCard key={e.instrumentSymbol} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      {/* Performance + system health (spec §22) */}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Account (paper)</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Equity" value={formatMoney(view.accountEquity)} />
            <Stat label="Qualified now" value={summary.qualified} tone="accent" />
          </div>
          <Disclaimer />
        </Card>

        <Card>
          <CardTitle>System health</CardTitle>
          <ul className="space-y-2 text-sm">
            <HealthRow label="Signal engine" tone="bull" text="Operational (deterministic)" />
            <HealthRow
              label="Data feed"
              tone={feed.quality === 'healthy' ? 'bull' : 'warn'}
              text={`${feed.quality} — demo generator`}
            />
            <HealthRow label="Deriv connection" tone="muted" text="Not configured (demo)" />
            <HealthRow label="Supabase" tone="muted" text="Not configured (demo)" />
          </ul>
        </Card>
      </div>
    </>
  );
}

function HealthRow({
  label,
  tone,
  text,
}: {
  label: string;
  tone: 'bull' | 'warn' | 'muted' | 'bear';
  text: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <Dot tone={tone} label={text} />
    </li>
  );
}
