import Link from 'next/link';
import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle, Badge, Stat } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { listSignals } from '@/lib/supabase/repositories/signals';
import { getSignalLog, type OutcomeLogRow } from '@/lib/supabase/repositories/outcomes';
import { formatPrice, formatPercent, formatRR, titleCase } from '@/lib/utils/format';
import { HistoryFilters } from '@/components/history-filters';

export const metadata = { title: 'History — VoltaX' };
export const dynamic = 'force-dynamic';

const OUTCOME_TONE: Record<OutcomeLogRow['status'], 'bull' | 'bear' | 'warn' | 'muted'> = {
  win: 'bull',
  loss: 'bear',
  expired: 'warn',
  pending: 'muted',
};

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
  const period = ['1d', '7d', '90d', 'all'].includes(params.period ?? '') ? params.period! : '30d';
  const cutoffDays = period === '1d' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? null : 30;
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60_000 : null;
  const cutoffIso = cutoff ? new Date(cutoff).toISOString() : null;

  const [allSignals, log] = await Promise.all([listSignals(500), getSignalLog(cutoffIso)]);
  const logRows = (log?.rows ?? []).filter((r) => !params.symbol || r.symbol === params.symbol);
  const stats = log?.stats;
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

      {stats && stats.total > 0 ? (
        <Card className="mb-6">
          <CardTitle hint="Auto-logged by the cloud scanner, resolved against live price">
            Qualified signal log
          </CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tracked" value={stats.total} />
            <Stat label="Wins" value={stats.wins} tone="bull" />
            <Stat label="Losses" value={stats.losses} tone="bear" />
            <Stat label="Win rate" value={stats.winRate !== null ? formatPercent(stats.winRate * 100) : '—'} />
            <Stat label="Reliability" value={stats.wilsonLower !== null ? formatPercent(stats.wilsonLower * 100) : '—'} />
            <Stat label="Expectancy" value={`${stats.expectancyR >= 0 ? '+' : ''}${stats.expectancyR.toFixed(2)}R`} tone={stats.expectancyR >= 0 ? 'bull' : 'bear'} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Index</th>
                  <th className="px-3 py-2 font-medium">Dir</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 text-right font-medium">Entry</th>
                  <th className="px-3 py-2 text-right font-medium">Stop</th>
                  <th className="px-3 py-2 text-right font-medium">Target</th>
                  <th className="px-3 py-2 text-right font-medium">R:R</th>
                  <th className="px-3 py-2 font-medium">Signalled</th>
                </tr>
              </thead>
              <tbody>
                {logRows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.symbol}-${r.createdAt}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/signals/${r.symbol}`} className="font-medium text-accent hover:underline">{r.symbol}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={r.direction === 'long' ? 'bull' : 'bear'}>{r.direction === 'long' ? 'LONG' : 'SHORT'}</Badge>
                    </td>
                    <td className="px-3 py-2"><Badge tone={OUTCOME_TONE[r.status]}>{titleCase(r.status)}</Badge></td>
                    <td className="tnum px-3 py-2 text-right">{formatPrice(r.entry)}</td>
                    <td className="tnum px-3 py-2 text-right text-muted">{formatPrice(r.stopLoss)}</td>
                    <td className="tnum px-3 py-2 text-right text-muted">{formatPrice(r.takeProfit)}</td>
                    <td className="tnum px-3 py-2 text-right">{formatRR(r.riskReward)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Every qualified signal is logged automatically by the cloud scanner (no browser needed) and resolved against live
            candles — win = first target hit, loss = stop hit (a bar touching both counts as the stop). Win rate excludes still-open
            and expired signals; reliability is the conservative Wilson lower bound. Historical performance is not a guarantee.
          </p>
        </Card>
      ) : null}

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
