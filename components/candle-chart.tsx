import type { Candle, SwingPoint, Zone } from '@/lib/types';

interface Level {
  price: number;
  label: string;
  tone: 'bull' | 'bear' | 'accent';
}

/** Minimal, dependency-free SVG candlestick chart (spec §25). Renders OHLC candles
 * with optional horizontal levels (entry/stop/TP), swing-point markers and
 * supply/demand zones. Theme-aware via CSS token variables. */
export function CandleChart({
  candles,
  levels = [],
  swings = [],
  zones = [],
  height = 320,
}: {
  candles: Candle[];
  levels?: Level[];
  swings?: SwingPoint[];
  zones?: Zone[];
  height?: number;
}) {
  if (candles.length === 0) {
    return <div className="text-sm text-muted">No candle data.</div>;
  }
  const width = 900;
  const padX = 8;
  const padY = 12;
  const allPrices = candles
    .flatMap((c) => [c.high, c.low])
    .concat(levels.map((l) => l.price))
    .concat(zones.flatMap((z) => [z.top, z.bottom]));
  const max = Math.max(...allPrices);
  const min = Math.min(...allPrices);
  const range = max - min || 1;
  const plotH = height - padY * 2;
  const plotW = width - padX * 2;
  const n = candles.length;
  const slot = plotW / n;
  const cw = Math.max(1, slot * 0.6);
  const firstTime = candles[0]!.time;
  const lastTime = candles[n - 1]!.time;
  const span = lastTime - firstTime || 1;

  const y = (p: number) => padY + (1 - (p - min) / range) * plotH;
  // Map a candle index to x; for zones/swings we map by index directly.
  const xAt = (i: number) => padX + i * slot + slot / 2;
  const idxOfTime = (t: number) =>
    Math.round(((t - firstTime) / span) * (n - 1));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Price candlestick chart with structure"
      >
        {/* Supply/demand zones as shaded bands from origin to the right edge. */}
        {zones.map((z, i) => {
          const color = z.kind === 'demand' || z.kind === 'support' ? 'var(--bull)' : 'var(--bear)';
          const x0 = xAt(Math.max(0, Math.min(n - 1, z.originIndex)));
          const top = y(z.top);
          const bottom = y(z.bottom);
          return (
            <rect
              key={`z${i}`}
              x={x0}
              y={Math.min(top, bottom)}
              width={width - padX - x0}
              height={Math.max(1, Math.abs(bottom - top))}
              fill={`hsl(${color} / 0.10)`}
              stroke={`hsl(${color} / 0.30)`}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Horizontal levels (entry/stop/TP). */}
        {levels.map((l, i) => {
          const color = l.tone === 'bull' ? 'var(--bull)' : l.tone === 'bear' ? 'var(--bear)' : 'var(--accent)';
          return (
            <g key={`l${i}`}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y(l.price)}
                y2={y(l.price)}
                stroke={`hsl(${color})`}
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.8}
              />
              <text x={width - padX} y={y(l.price) - 3} textAnchor="end" fontSize={10} fill={`hsl(${color})`}>
                {l.label}
              </text>
            </g>
          );
        })}

        {/* Candles. */}
        {candles.map((c, i) => {
          const cx = xAt(i);
          const up = c.close >= c.open;
          const color = up ? 'var(--bull)' : 'var(--bear)';
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          return (
            <g key={i} stroke={`hsl(${color})`} fill={`hsl(${color})`}>
              <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} strokeWidth={1} />
              <rect
                x={cx - cw / 2}
                y={bodyTop}
                width={cw}
                height={Math.max(1, bodyBottom - bodyTop)}
                opacity={up ? 0.9 : 0.85}
              />
            </g>
          );
        })}

        {/* Swing points. */}
        {swings.map((s, i) => {
          const idx = s.index >= 0 && s.index < n ? s.index : idxOfTime(s.time);
          const cx = xAt(Math.max(0, Math.min(n - 1, idx)));
          const py = y(s.price);
          const isHigh = s.type === 'high';
          return (
            <circle
              key={`s${i}`}
              cx={cx}
              cy={py + (isHigh ? -4 : 4)}
              r={1.8}
              fill={isHigh ? 'hsl(var(--bear))' : 'hsl(var(--bull))'}
              opacity={0.8}
            />
          );
        })}
      </svg>
    </div>
  );
}
