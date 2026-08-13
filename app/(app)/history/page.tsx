import Link from 'next/link';
import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { listSignals } from '@/lib/supabase/repositories/signals';
import { formatPrice, formatPercent, formatRR, titleCase } from '@/lib/utils/format';
import { HistoryFilters } from '@/components/history-filters';

export const metadata = { title: 'History — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ period?: string; symbol?: string }> }) {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader title="Signal History" subtitle="Every generated signal, searchable and auditable." />
        <ConfigNotice title="Signal history requires Supabase">
          Signals are persisted immutably with their original conditions, calculations,
          methodology version and final result once Supabase is configured (see
          docs/DATABASE.md). The schema and persistence layer are implemented; this page
          lists your saved signals as soon as persistence is connected.
        </ConfigNotice>
      </>
    );
  }

  const params = await searchParams;
  const period = params.period === '7d' || params.period === '90d' || params.period === 'all' ? params.period : '30d';
  const cutoffDays = period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? null : 30;
  const allSignals = await listSignals(500);
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60_000 : null;
  const signals = allSignals.filter((signal) =>
    (!params.symbol || signal.instrument_symbol === params.symbol) &&
    (!cutoff || new Date(signal.created_at).getTime() >= cutoff),
  );
  const averageReliability = signals.length ? signals.reduce((sum, signal) => sum + Number(signal.reliability_score), 0) / signals.length : 0;
  const averageRiskReward = signals.length ? signals.reduce((sum, signal) => sum + Number(signal.risk_reward), 0) / signals.length : 0;
  const qualified = signals.filter((signal) => signal.status === 'qualified').length;
  const symbols = [...new Set(allSignals.map((signal) => signal.instrument_symbol))].sort();

  return (
    <>
      <PageHeader
        title="Signal History"
        subtitle="Persisted signals with their original conditions and methodology version."
      />
      <HistoryFilters symbols={symbols} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs font-medium uppercase tracking-wide text-muted">Recorded signals</p><p className="tnum mt-1 text-2xl font-bold text-fg">{signals.length}</p></Card>
        <Card><p className="text-xs font-medium uppercase tracking-wide text-muted">Qualified</p><p className="tnum mt-1 text-2xl font-bold text-accent">{qualified}</p></Card>
        <Card><p className="text-xs font-medium uppercase tracking-wide text-muted">Average quality</p><p className="tnum mt-1 text-2xl font-bold text-fg">{formatPercent(averageReliability)} <span className="text-sm font-medium text-muted">· {formatRR(averageRiskReward)}</span></p></Card>
      </div>
      {signals.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No signals match these filters. Qualified signals are recorded automatically while
            your authenticated dashboard is scanning; individual reads can still be saved manually.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle hint={`${signals.length} recorded`}>Signals</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Index</th>
                  <th className="px-3 py-2 font-medium">Dir</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Entry</th>
                  <th className="px-3 py-2 text-right font-medium">R:R</th>
                  <th className="px-3 py-2 text-right font-medium">Reliability</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/signals/${s.instrument_symbol}`} className="font-medium text-accent hover:underline">
                        {s.instrument_symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={s.direction === 'long' ? 'bull' : 'bear'}>
                        {s.direction === 'long' ? 'LONG' : 'SHORT'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted">{titleCase(s.status)}</td>
                    <td className="tnum px-3 py-2 text-right">{formatPrice(Number(s.entry_price))}</td>
                    <td className="tnum px-3 py-2 text-right">{formatRR(Number(s.risk_reward))}</td>
                    <td className="tnum px-3 py-2 text-right">{formatPercent(Number(s.reliability_score))}</td>
                    <td className="px-3 py-2 text-xs text-muted">{s.methodology_version}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
