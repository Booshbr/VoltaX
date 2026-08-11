import type { Candle } from '@/lib/types';

interface Level {
  price: number;
  label: string;
  tone: 'bull' | 'bear' | 'accent';
}

/** Minimal, dependency-free SVG candlestick chart (spec §25). Renders OHLC
 * candles with optional horizontal levels (entry/stop/TP). Theme-aware via
 * currentColor / token classes. */
export function CandleChart({
  candles,
  levels = [],
  height = 260,
}: {
  candles: Candle[];
  levels?: Level[];
  height?: number;
}) {
  if (candles.length === 0) {
    return <div className="text-sm text-muted">No candle data.</div>;
  }
  const width = 720;
  const padX = 8;
  const padY = 12;
  const allPrices = candles.flatMap((c) => [c.high, c.low]).concat(levels.map((l) => l.price));
  const max = Math.max(...allPrices);
  const min = Math.min(...allPrices);
  const range = max - min || 1;
  const plotH = height - padY * 2;
  const plotW = width - padX * 2;
  const n = candles.length;
  const slot = plotW / n;
  const cw = Math.max(1, slot * 0.6);

  const y = (p: number) => padY + (1 - (p - min) / range) * plotH;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Price candlestick chart"
      >
        {levels.map((l, i) => {
          const color = l.tone === 'bull' ? 'var(--bull)' : l.tone === 'bear' ? 'var(--bear)' : 'var(--accent)';
          return (
            <g key={i}>
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
        {candles.map((c, i) => {
          const cx = padX + i * slot + slot / 2;
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
      </svg>
    </div>
  );
}
