import { getDemoPerformance } from '@/lib/demo/dataset';
import { PageHeader, Disclaimer } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { METHODOLOGY_VERSION } from '@/lib/config/strategy';
import { formatPercent, titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Backtesting — VoltaX' };

export default function BacktestingPage() {
  const perf = getDemoPerformance();
  return (
    <>
      <PageHeader
        title="Backtesting"
        subtitle="Event-driven replay through the same engine used live — with look-ahead guards."
        actions={<Badge tone="accent">{METHODOLOGY_VERSION}</Badge>}
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
        <CardTitle hint="Per instrument, demo data">Runs</CardTitle>
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
                  <td className="px-3 py-2 font-medium text-fg">{r.symbol}</td>
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
    </>
  );
}
