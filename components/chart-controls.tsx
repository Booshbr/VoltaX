'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'] as const;

/** Instrument + timeframe switcher for the Charts page. Updates the URL query so
 * the server re-renders the chart for the selection. */
export function ChartControls({
  symbols,
  symbol,
  tf,
}: {
  symbols: string[];
  symbol: string;
  tf: string;
}) {
  const router = useRouter();
  const go = (nextSymbol: string, nextTf: string) =>
    router.push(`/charts?symbol=${encodeURIComponent(nextSymbol)}&tf=${nextTf}`);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <label className="inline-flex items-center gap-1.5 text-sm">
        <span className="text-muted">Index</span>
        <select
          value={symbol}
          onChange={(e) => go(e.target.value, tf)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-fg"
        >
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => go(symbol, t)}
            aria-pressed={t === tf}
            className={cn(
              'px-3 py-1 text-xs font-medium transition-colors',
              t === tf ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
