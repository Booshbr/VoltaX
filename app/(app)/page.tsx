import Link from 'next/link';
import { getMarketView } from '@/lib/market/source';
import { Disclaimer, SourceBadge } from '@/components/page';
import { Card, CardTitle, Dot, Stat } from '@/components/ui';
import { SignalCard } from '@/components/signal-card';
import { NotificationSync } from '@/components/notifications/notification-sync';
import { ExposureWidget } from '@/components/dashboard/exposure-widget';
import type { QualifiedSignalInput } from '@/lib/notifications/inapp';
import { dispatchQualifiedAlerts } from '@/lib/notifications/dispatch';
import { formatMoney, formatPercent, titleCase } from '@/lib/utils/format';
import { recordQualifiedSignals } from '@/lib/supabase/repositories/signals';
import { getDerivAccountSummary } from '@/lib/deriv/account';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [view, account] = await Promise.all([getMarketView(), getDerivAccountSummary()]);
  const { summary, evaluations, feed, source } = view;
  const isLive = source === 'live';
  const qualified = evaluations.filter((evaluation) => evaluation.qualified);
  const top = (qualified.length ? qualified : evaluations).slice(0, 3);
  const lead = top[0];

  const qualifiedSignals: QualifiedSignalInput[] = qualified
    .filter((evaluation) => evaluation.direction && evaluation.risk)
    .map((evaluation) => ({
      symbol: evaluation.instrumentSymbol,
      direction: evaluation.direction as 'long' | 'short',
      reliability: evaluation.reliability.score,
      opportunityScore: evaluation.opportunityScore,
      riskReward: evaluation.riskReward,
      entry: evaluation.risk!.entry,
      stopLoss: evaluation.risk!.stopLoss,
      takeProfits: evaluation.risk!.takeProfits.map((target) => target.price),
      methodologyVersion: evaluation.methodologyVersion,
    }));

  await Promise.all([dispatchQualifiedAlerts(qualifiedSignals), recordQualifiedSignals(qualified)]);

  return (
    <>
      <NotificationSync signals={qualifiedSignals} />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">VoltaX intelligence</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.055em] text-fg md:text-4xl">Your market workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">A deterministic view of structure, opportunity and risk across Deriv synthetic indices.</p>
        </div>
        <SourceBadge source={source} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-fg p-6 text-surface shadow-[0_18px_40px_hsl(var(--fg)/0.16)] md:p-7">
          <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-accent/35 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-surface/60">
                  {account.connected ? (account.isVirtual ? 'Deriv demo balance' : 'Deriv real balance') : 'Paper account'}
                </p>
                <p className="tnum mt-3 text-4xl font-semibold tracking-[-0.06em] md:text-5xl">
                  {formatMoney(account.connected && account.balance !== undefined ? account.balance : view.accountEquity)}
                  {account.connected && account.currency ? <span className="ml-2 text-base font-medium text-surface/60">{account.currency}</span> : null}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-surface/20 bg-surface/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-surface">
                <span className="h-2 w-2 rounded-full bg-bull" aria-hidden />
                Engine online
              </span>
            </div>
            <div className="mt-9 grid max-w-md grid-cols-3 gap-5 border-t border-surface/15 pt-5">
              <DarkMetric label="Markets scanned" value={summary.scanned} />
              <DarkMetric label="Qualified now" value={summary.qualified} />
              <DarkMetric label="Developing" value={summary.developing} />
            </div>
          </div>
        </div>

        <Card className="flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Leading opportunity</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-fg">{lead?.instrumentSymbol ?? 'No market available'}</h2>
            </div>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent">{lead ? titleCase(lead.status) : 'Waiting'}</span>
          </div>
          {lead ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric label="Opportunity score" value={`${lead.opportunityScore}/100`} />
              <MiniMetric label="Reliability" value={formatPercent(lead.reliability.score)} />
            </div>
          ) : null}
          <Link href={lead ? `/signals/${lead.instrumentSymbol}` : '/signals'} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-surface transition-opacity hover:opacity-90">
            Review analysis
          </Link>
        </Card>
      </section>

      <div className="mt-4">
        <ExposureWidget />
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><Stat label="Bullish bias" value={summary.bullish} tone="bull" /></Card>
        <Card><Stat label="Bearish bias" value={summary.bearish} tone="bear" /></Card>
        <Card><Stat label="Neutral" value={summary.neutral} /></Card>
        <Card><Stat label="Data feed" value={titleCase(feed.quality)} tone={feed.quality === 'healthy' ? 'bull' : feed.quality === 'stale' ? 'bear' : 'warn'} /></Card>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Ranked market intelligence</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-0.04em] text-fg">Top opportunities</h2>
          </div>
          <Link href="/signals" className="text-sm font-bold text-accent hover:underline">View all signals →</Link>
        </div>
        {top.length === 0 ? (
          <Card><p className="text-sm leading-6 text-muted">No qualified setups right now. That is a valid result — VoltaX does not manufacture signals to look busy.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{top.map((evaluation) => <SignalCard key={evaluation.instrumentSymbol} evaluation={evaluation} />)}</div>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardTitle hint="Paper account only">Account context</CardTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><Stat label="Available paper equity" value={formatMoney(view.accountEquity)} /><Disclaimer /></div>
            <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-bold text-fg">Risk-first operation</p><p className="mt-1 text-xs leading-5 text-muted">Signals remain explainable, historical and statistical. They are never a guarantee of future results.</p></div>
          </div>
        </Card>
        <Card>
          <CardTitle>System health</CardTitle>
          <ul className="space-y-3 text-sm">
            <HealthRow label="Signal engine" tone="bull" text="Operational" />
            <HealthRow label="Data feed" tone={feed.quality === 'healthy' ? 'bull' : feed.quality === 'stale' ? 'bear' : 'warn'} text={`${titleCase(feed.quality)} · ${isLive ? 'Deriv live feed' : 'Demo generator'}`} />
            <HealthRow label="Deriv connection" tone={isLive ? 'bull' : 'muted'} text={isLive ? 'Connected' : 'Demo mode'} />
          </ul>
        </Card>
      </section>
    </>
  );
}

function DarkMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-surface/55">{label}</p><p className="tnum mt-1 text-lg font-semibold text-surface">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-2 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p><p className="tnum mt-1 text-base font-bold tracking-[-0.03em] text-fg">{value}</p></div>;
}

function HealthRow({ label, tone, text }: { label: string; tone: 'bull' | 'warn' | 'muted' | 'bear'; text: string }) {
  return <li className="flex items-center justify-between gap-3"><span className="text-muted">{label}</span><Dot tone={tone} label={text} /></li>;
}
