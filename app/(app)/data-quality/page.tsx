import { getDataQuality } from '@/lib/market/source';
import { PageHeader, SourceBadge } from '@/components/page';
import { Card, CardTitle, Dot, Badge } from '@/components/ui';
import { titleCase } from '@/lib/utils/format';
import type { DataQuality } from '@/lib/types';

export const metadata = { title: 'Data Quality — VoltaX' };
export const dynamic = 'force-dynamic';

const TONE: Record<DataQuality, 'bull' | 'warn' | 'bear' | 'muted'> = {
  healthy: 'bull',
  delayed: 'warn',
  stale: 'bear',
  unknown: 'muted',
};

function age(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

export default async function DataQualityPage() {
  const report = await getDataQuality();

  return (
    <>
      <PageHeader
        title="Data Quality"
        subtitle="Feed freshness and integrity checks. Stale data pauses new signals (spec §40)."
        actions={<SourceBadge source={report.source} />}
      />

      <Card className="mb-4">
        <CardTitle>Feed</CardTitle>
        <div className="flex items-center justify-between">
          <Dot tone={TONE[report.overall.quality]} label={titleCase(report.overall.quality)} />
          <span className="text-xs text-muted">
            {report.source === 'demo'
              ? 'Demo generator — synthetic, internally consistent data'
              : `Freshest instrument ${age(report.overall.lastUpdateMs)}`}
          </span>
        </div>
        {report.overall.issues.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-warn">
            {report.overall.issues.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <CardTitle hint={`${report.instruments.length} instruments`}>Per-instrument</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Index</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Last update</th>
                <th className="px-3 py-2 text-right font-medium">Candles</th>
                <th className="px-3 py-2 text-right font-medium">Gaps</th>
                <th className="px-3 py-2 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {report.instruments.map((q) => (
                <tr key={q.symbol} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{q.symbol}</td>
                  <td className="px-3 py-2">
                    <Dot tone={TONE[q.quality]} label={titleCase(q.quality)} />
                  </td>
                  <td className="tnum px-3 py-2 text-right text-muted">
                    {report.source === 'demo' ? '—' : age(q.lastUpdateMs)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-muted">
                    {q.candleCount || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {q.gaps > 0 ? <Badge tone="warn">{q.gaps}</Badge> : <span className="text-muted">0</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{q.issues.join('; ') || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
