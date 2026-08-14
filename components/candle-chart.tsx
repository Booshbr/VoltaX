import type { Candle, SwingPoint, Zone } from '@/lib/types';

interface Level {
  price: number;
  label: string;
  tone: 'bull' | 'bear' | 'accent';
}

/** Dependency-free candlestick chart with UTC time and price axes. */
export function CandleChart({
  candles,
  levels = [],
  swings = [],
  zones = [],
  height = 320,
  currentPrice,
}: {
  candles: Candle[];
  levels?: Level[];
  swings?: SwingPoint[];
  zones?: Zone[];
  height?: number;
  /** Latest verified price. Defaults to the latest candle close. */
  currentPrice?: number;
}) {
  if (candles.length === 0) return <div className="text-sm text-muted">No candle data.</div>;

  const width = 900;
  const padLeft = 10;
  const padTop = 12;
  const padBottom = 28;
  const axisWidth = 78;
  const plotRight = width - axisWidth;
  const plotH = height - padTop - padBottom;
  const plotW = plotRight - padLeft;
  const allPrices = candles.flatMap((c) => [c.high, c.low]).concat(levels.map((l) => l.price), zones.flatMap((z) => [z.top, z.bottom]));
  const rawMax = Math.max(...allPrices);
  const rawMin = Math.min(...allPrices);
  const padding = (rawMax - rawMin || 1) * 0.06;
  const max = rawMax + padding;
  const min = rawMin - padding;
  const range = max - min || 1;
  const n = candles.length;
  const slot = plotW / n;
  const candleWidth = Math.max(1, slot * 0.6);
  const firstTime = candles[0]!.time;
  const lastTime = candles[n - 1]!.time;
  const span = lastTime - firstTime || 1;
  const priceDecimals = Math.max(2, Math.min(5, inferDecimals(candles)));
  const y = (price: number) => padTop + (1 - (price - min) / range) * plotH;
  const xAt = (index: number) => padLeft + index * slot + slot / 2;
  const idxOfTime = (time: number) => Math.round(((time - firstTime) / span) * (n - 1));
  const gridRows = 5;
  const gridColumns = 6;
  const latestPrice = currentPrice ?? candles[n - 1]!.close;
  const currentY = y(latestPrice);
  const currentTone = latestPrice >= candles[n - 1]!.open ? 'var(--bull)' : 'var(--bear)';

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-surface-2/30 p-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[680px]" role="img" aria-label="Price candlestick chart with price and UTC time axes">
        <rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="hsl(var(--bg) / 0.24)" />

        {/* Price/time grid and axes are deliberately behind all market annotations. */}
        {Array.from({ length: gridRows + 1 }, (_, index) => {
          const price = max - (range * index) / gridRows;
          const py = y(price);
          return (
            <g key={`price-grid-${index}`}>
              <line x1={padLeft} x2={plotRight} y1={py} y2={py} stroke="hsl(var(--border) / 0.7)" strokeWidth={0.7} />
              <text x={plotRight + 6} y={py + 3.5} fill="hsl(var(--muted))" fontSize={10} className="tnum">
                {price.toFixed(priceDecimals)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: gridColumns + 1 }, (_, index) => {
          const candleIndex = Math.round(((n - 1) * index) / gridColumns);
          const px = xAt(candleIndex);
          const time = candles[candleIndex]!.time;
          return (
            <g key={`time-grid-${index}`}>
              <line x1={px} x2={px} y1={padTop} y2={padTop + plotH} stroke="hsl(var(--border) / 0.48)" strokeWidth={0.7} />
              <text x={px} y={height - 8} textAnchor={index === 0 ? 'start' : index === gridColumns ? 'end' : 'middle'} fill="hsl(var(--muted))" fontSize={10} className="tnum">
                {formatUtcTime(time, span)}
              </text>
            </g>
          );
        })}
        <line x1={padLeft} x2={plotRight} y1={padTop + plotH} y2={padTop + plotH} stroke="hsl(var(--border))" />
        <line x1={plotRight} x2={plotRight} y1={padTop} y2={padTop + plotH} stroke="hsl(var(--border))" />

        {zones.map((zone, index) => {
          const color = zone.kind === 'demand' || zone.kind === 'support' ? 'var(--bull)' : 'var(--bear)';
          const x0 = xAt(Math.max(0, Math.min(n - 1, zone.originIndex)));
          const top = y(zone.top);
          const bottom = y(zone.bottom);
          return <rect key={`zone-${index}`} x={x0} y={Math.min(top, bottom)} width={plotRight - x0} height={Math.max(1, Math.abs(bottom - top))} fill={`hsl(${color} / 0.10)`} stroke={`hsl(${color} / 0.30)`} strokeWidth={0.5} />;
        })}

        {levels.map((level, index) => {
          const color = level.tone === 'bull' ? 'var(--bull)' : level.tone === 'bear' ? 'var(--bear)' : 'var(--accent)';
          return (
            <g key={`level-${index}`}>
              <line x1={padLeft} x2={plotRight} y1={y(level.price)} y2={y(level.price)} stroke={`hsl(${color})`} strokeDasharray="4 4" strokeWidth={1} opacity={0.85} />
              <text x={plotRight - 4} y={y(level.price) - 3} textAnchor="end" fontSize={10} fill={`hsl(${color})`}>{level.label}</text>
            </g>
          );
        })}

        {candles.map((candle, index) => {
          const x = xAt(index);
          const up = candle.close >= candle.open;
          const color = up ? 'var(--bull)' : 'var(--bear)';
          const top = y(Math.max(candle.open, candle.close));
          const bottom = y(Math.min(candle.open, candle.close));
          return (
            <g key={`${candle.time}-${index}`} stroke={`hsl(${color})`} fill={`hsl(${color})`}>
              <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} strokeWidth={1} />
              <rect x={x - candleWidth / 2} y={top} width={candleWidth} height={Math.max(1, bottom - top)} opacity={up ? 0.9 : 0.85} />
            </g>
          );
        })}

        {/* Latest quote: this line moves as the tick stream updates the live candle. */}
        <g aria-label={`Current price ${latestPrice.toFixed(priceDecimals)}`}>
          <line x1={padLeft} x2={plotRight} y1={currentY} y2={currentY} stroke={`hsl(${currentTone})`} strokeDasharray="3 3" strokeWidth={1.2} opacity={0.95} />
          <circle cx={xAt(n - 1)} cy={currentY} r={3.2} fill={`hsl(${currentTone})`} stroke="hsl(var(--surface))" strokeWidth={1.2} />
          <rect x={plotRight + 2} y={currentY - 10} width={73} height={20} rx={4} fill={`hsl(${currentTone})`} />
          <text x={plotRight + 38.5} y={currentY + 3.5} textAnchor="middle" fill="hsl(var(--bg))" fontSize={10} fontWeight={700} className="tnum">
            {latestPrice.toFixed(priceDecimals)}
          </text>
        </g>

        {swings.map((swing, index) => {
          const candleIndex = swing.index >= 0 && swing.index < n ? swing.index : idxOfTime(swing.time);
          const x = xAt(Math.max(0, Math.min(n - 1, candleIndex)));
          const high = swing.type === 'high';
          return <circle key={`swing-${index}`} cx={x} cy={y(swing.price) + (high ? -4 : 4)} r={1.8} fill={high ? 'hsl(var(--bear))' : 'hsl(var(--bull))'} opacity={0.85} />;
        })}
      </svg>
    </div>
  );
}

function inferDecimals(candles: Candle[]): number {
  const sample = candles.slice(-10).map((c) => c.close);
  return sample.reduce((max, value) => Math.max(max, decimalPlaces(value)), 2);
}

function decimalPlaces(value: number): number {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function formatUtcTime(epoch: number, span: number): string {
  const iso = new Date(epoch * 1000).toISOString();
  return span >= 86_400 ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : iso.slice(11, 16);
}
