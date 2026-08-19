import { getPerformance } from '@/lib/market/source';
import { PageHeader, Disclaimer, SourceBadge } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { METHODOLOGY_VERSION } from '@/lib/config/strategy';
import { formatPercent, titleCase, formatSymbolName } from '@/lib/utils/format';
import { OptimizerPanel } from '@/components/backtesting/optimizer-panel';

export const metadata = { title: 'Backtesting — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function BacktestingPage() {
  const perf = await getPerformance();
  return (
    <>
      <PageHeader
        title="Backtesting"
        subtitle="Event-driven replay through the same engine used live — with look-ahead guards."
        actions={
          <div className="flex items-center gap-2">
            <SourceBadge source={perf.source} />
            <Badge tone="accent">{METHODOLOGY_VERSION}</Badge>
          </div>
        }
      />

      <Card className="mb-4 border-accent/30 bg-accent/5">
        <p className="text-sm text-muted">
          The backtester feeds the engine only candles whose close time is at or
          before each decision point, structurally preventing future-data leakage.
          The strategy engine is shared across backtest, paper and live so results
          cannot drift from live behaviour.
        </p>
      </Card>

      <Card>
        <CardTitle hint="Per instrument">Runs</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Index</th>
                <th className="px-3 py-2 font-medium">Family</th>
                <th className="px-3 py-2 text-right font-medium">Trades</th>
                <th className="px-3 py-2 text-right font-medium">Wins</th>
                <th className="px-3 py-2 text-right font-medium">Win rate</th>
                <th className="px-3 py-2 text-right font-medium">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {perf.rows.map((r) => (
                <tr key={r.symbol} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{formatSymbolName(r.symbol)}</td>
                  <td className="px-3 py-2 text-muted">{titleCase(r.family)}</td>
                  <td className="tnum px-3 py-2 text-right">{r.trades}</td>
                  <td className="tnum px-3 py-2 text-right text-bull">{r.wins}</td>
                  <td className="tnum px-3 py-2 text-right">{r.winRate !== null ? formatPercent(r.winRate * 100) : '—'}</td>
                  <td className={`tnum px-3 py-2 text-right ${r.expectancyR >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {r.expectancyR >= 0 ? '+' : ''}{r.expectancyR.toFixed(2)}R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Disclaimer />
      </Card>

      <OptimizerPanel />
    </>
  );
}
