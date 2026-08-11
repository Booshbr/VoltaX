'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { EngineEvaluation } from '@/lib/signals/engine';
import { Badge } from './ui';
import { titleCase, formatPercent, formatRR } from '@/lib/utils/format';

type SortKey = 'opportunity' | 'reliability' | 'rr';
type DirFilter = 'all' | 'long' | 'short';
type StatusFilter = 'all' | 'qualified' | 'developing';

/** Real-time market radar table (spec §23). Client-side sort/filter over the
 * server-provided evaluations. */
export function RadarTable({ evaluations }: { evaluations: EngineEvaluation[] }) {
  const [sort, setSort] = useState<SortKey>('opportunity');
  const [dir, setDir] = useState<DirFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const rows = useMemo(() => {
    let r = [...evaluations];
    if (dir !== 'all') r = r.filter((e) => e.direction === dir);
    if (status !== 'all') r = r.filter((e) => e.status === status);
    r.sort((a, b) => {
      if (sort === 'reliability') return b.reliability.score - a.reliability.score;
      if (sort === 'rr') return b.riskReward - a.riskReward;
      return b.opportunityScore - a.opportunityScore;
    });
    return r;
  }, [evaluations, sort, dir, status]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)} options={[
          ['opportunity', 'Opportunity'],
          ['reliability', 'Reliability'],
          ['rr', 'Risk/Reward'],
        ]} />
        <Select label="Direction" value={dir} onChange={(v) => setDir(v as DirFilter)} options={[
          ['all', 'All'],
          ['long', 'Long'],
          ['short', 'Short'],
        ]} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[
          ['all', 'All'],
          ['qualified', 'Qualified'],
          ['developing', 'Developing'],
        ]} />
        <span className="ml-auto text-muted">{rows.length} of {evaluations.length} markets</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <Th>Index</Th>
              <Th>Family</Th>
              <Th>Dir</Th>
              <Th>4H</Th>
              <Th>15M</Th>
              <Th className="text-right">Reliability</Th>
              <Th className="text-right">R:R</Th>
              <Th className="text-right">Opportunity</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.instrumentSymbol} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <Link href={`/signals/${e.instrumentSymbol}`} className="font-medium text-accent hover:underline">
                    {e.instrumentSymbol}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">{titleCase(e.family)}</td>
                <td className="px-3 py-2">
                  {e.direction ? (
                    <Badge tone={e.direction === 'long' ? 'bull' : 'bear'}>{e.direction === 'long' ? 'LONG' : 'SHORT'}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{titleCase(e.htf.bias)}</td>
                <td className="px-3 py-2 text-muted">{e.setup.status === 'none' ? '—' : titleCase(e.setup.status)}</td>
                <td className="tnum px-3 py-2 text-right">{formatPercent(e.reliability.score)}</td>
                <td className="tnum px-3 py-2 text-right">{formatRR(e.riskReward)}</td>
                <td className="tnum px-3 py-2 text-right font-semibold">{e.opportunityScore}</td>
                <td className="px-3 py-2">
                  <Badge tone={e.qualified ? 'accent' : e.status === 'developing' ? 'warn' : 'muted'}>
                    {titleCase(e.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-fg"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
