'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function HistoryFilters({ symbols }: { symbols: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = searchParams.get('period') ?? '30d';
  const symbol = searchParams.get('symbol') ?? '';

  function update(key: 'period' | 'symbol', value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="History filters">
      <label className="text-xs font-medium text-muted">
        Period
        <select value={period} onChange={(event) => update('period', event.target.value)} className="ml-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg">
          <option value="1d">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </label>
      <label className="text-xs font-medium text-muted">
        Market
        <select value={symbol} onChange={(event) => update('symbol', event.target.value)} className="ml-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg">
          <option value="">All markets</option>
          {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}
