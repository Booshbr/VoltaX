import { getMarketView, getChartSeries, getMarketDetail } from '@/lib/market/source';
import { PageHeader, SourceBadge } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { ChartControls } from '@/components/chart-controls';
import { CandleChart } from '@/components/candle-chart';
import { BiasBadge, VolatilityBadge } from '@/components/domain';
import { TIMEFRAMES, type Timeframe } from '@/lib/types';
import { titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Charts — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; tf?: string }>;
}) {
  const { symbol: qSymbol, tf: qTf } = await searchParams;
  const view = await getMarketView();
  const symbols = view.evaluations.map((e) => e.instrumentSymbol);
  if (symbols.length === 0) {
    return (
      <>
        <PageHeader title="Charts" subtitle="Candlesticks with market structure." />
        <Card><p className="text-sm text-muted">No instruments available.</p></Card>
      </>
    );
  }

  const symbol = qSymbol && symbols.includes(qSymbol) ? qSymbol : symbols[0]!;
  const tf: Timeframe = (TIMEFRAMES as readonly string[]).includes(qTf ?? '') ? (qTf as Timeframe) : '15m';

  const [series, detail] = await Promise.all([getChartSeries(symbol, tf), getMarketDetail(symbol)]);
  const e = detail?.evaluation;

  const levels = e?.risk
    ? [
        { price: e.risk.entry, label: 'Entry', tone: 'accent' as const },
        { price: e.risk.stopLoss, label: 'Stop', tone: 'bear' as const },
        ...e.risk.takeProfits.map((t) => ({ price: t.price, label: `TP${t.level}`, tone: 'bull' as const })),
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Charts"
        subtitle="Candlesticks with swing structure, supply/demand zones and signal levels."
        actions={<SourceBadge source={series.source} />}
      />

      <ChartControls symbols={symbols} symbol={symbol} tf={tf} />

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <CardTitle hint={`${series.timeframe} · ${series.candles.length} bars`}>{symbol}</CardTitle>
          {e ? (
            <div className="flex items-center gap-2">
              <BiasBadge bias={e.htf.bias} />
              <VolatilityBadge condition={e.htf.volatility} />
              <Badge tone={e.qualified ? 'accent' : e.direction ? 'warn' : 'muted'}>{titleCase(e.status)}</Badge>
            </div>
          ) : null}
        </div>
        <CandleChart candles={series.candles} levels={levels} swings={series.swings} zones={series.zones} height={360} />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span>● <span className="text-bull">demand/support</span> &amp; <span className="text-bear">supply/resistance</span> zones</span>
          <span>Swing highs (red) / lows (green)</span>
          {levels.length ? <span>Dashed lines: entry / stop / take-profit</span> : null}
        </div>
      </Card>
    </>
  );
}
