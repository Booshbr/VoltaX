'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { formatPercent } from '@/lib/utils/format';

interface RiskData {
  connected: boolean;
  isVirtual?: boolean;
  currency?: string;
  dailyRealizedPnl?: number;
  exposurePct?: number;
  exposureLimitPct?: number;
  dailyLossPct?: number;
  dailyLossLimitPct?: number;
  openCount?: number;
  maxOpenTrades?: number;
  anyBreached?: boolean;
}

/** Compact live-exposure card for the dashboard. Fetches after render so it never
 * blocks the main page, and renders nothing until a live account is connected. */
export function ExposureWidget() {
  const [data, setData] = useState<RiskData | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/live/risk')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!data || !data.connected) return null;

  const pnl = data.dailyRealizedPnl ?? 0;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Live risk</p>
        <Link href="/live-trading" className="text-xs font-bold text-accent hover:underline">
          Manage →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Bar label="Exposure" value={data.exposurePct ?? 0} limit={data.exposureLimitPct ?? 0} />
        <Bar label="Daily loss" value={data.dailyLossPct ?? 0} limit={data.dailyLossLimitPct ?? 0} />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Positions</p>
          <p className="tnum mt-1 text-lg font-semibold text-fg">
            {data.openCount ?? 0}
            <span className="text-xs font-medium text-muted"> / {data.maxOpenTrades ?? 0}</span>
          </p>
          <p className={`mt-1 text-xs font-semibold ${pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
            {pnl >= 0 ? '+' : ''}
            {pnl.toFixed(2)} today
          </p>
        </div>
      </div>
      {data.anyBreached ? <p className="mt-3 text-xs font-semibold text-bear">Risk limit reached — new trades blocked.</p> : null}
    </Card>
  );
}

function Bar({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ratio = limit > 0 ? Math.min(1, value / limit) : 0;
  const breached = limit > 0 && value >= limit;
  const tone = breached ? 'bg-bear' : ratio > 0.66 ? 'bg-warn' : 'bg-bull';
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="tnum mt-1 text-lg font-semibold text-fg">{formatPercent(value * 100)}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}
