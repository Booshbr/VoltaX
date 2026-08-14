import type { DailyPnl } from '@/lib/deriv/positions';

/** Realised daily P/L as a zero-baseline bar chart (green up / red down). Pure,
 * dependency-free SVG so it renders on the server. */
export function DailyPnlChart({ data }: { data: DailyPnl[] }) {
  if (data.length === 0) return <p className="text-sm text-muted">No closed trades yet.</p>;

  const width = 720;
  const height = 180;
  const padTop = 10;
  const padBottom = 22;
  const plotH = height - padTop - padBottom;
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.pnl)));
  const slot = width / data.length;
  const barW = Math.max(2, slot * 0.6);
  const zeroY = padTop + plotH / 2;
  const y = (v: number) => zeroY - (v / maxAbs) * (plotH / 2);

  const total = data.reduce((s, d) => s + d.pnl, 0);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-muted">{data.length}-day realised P/L</span>
        <span className={`tnum text-sm font-bold ${total >= 0 ? 'text-bull' : 'text-bear'}`}>
          {total >= 0 ? '+' : ''}{total.toFixed(2)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border border-border/70 bg-surface-2/30 p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Daily realised profit and loss">
          <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="hsl(var(--border))" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = i * slot + slot / 2;
            const up = d.pnl >= 0;
            const yv = y(d.pnl);
            const barH = Math.abs(yv - zeroY);
            const color = d.pnl === 0 ? 'var(--muted)' : up ? 'var(--bull)' : 'var(--bear)';
            return (
              <g key={d.date}>
                <rect
                  x={cx - barW / 2}
                  y={up ? yv : zeroY}
                  width={barW}
                  height={Math.max(d.pnl === 0 ? 1 : 1, barH)}
                  fill={`hsl(${color})`}
                  opacity={0.9}
                >
                  <title>{`${d.date}: ${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}`}</title>
                </rect>
                {i % Math.ceil(data.length / 7) === 0 ? (
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted))" className="tnum">
                    {d.date.slice(5)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
