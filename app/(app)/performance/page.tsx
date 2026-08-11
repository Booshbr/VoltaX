import { getDemoPerformance } from '@/lib/demo/dataset';
import { PageHeader, Disclaimer } from '@/components/page';
import { Card, CardTitle, Stat } from '@/components/ui';
import { formatPercent, titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Performance — VoltaX' };

export default function PerformancePage() {
  const perf = getDemoPerformance();
  const t = perf.totals;

  return (
    <>
      <PageHeader title="Performance" subtitle="Backtested performance across the demo universe (look-ahead safe)." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><Stat label="Total trades" value={t.trades} /></Card>
        <Card><Stat label="Wins" value={t.wins} tone="bull" /></Card>
        <Card><Stat label="Losses" value={t.losses} tone="bear" /></Card>
        <Card><Stat label="Win rate" value={t.winRate !== null ? formatPercent(t.winRate * 100) : '—'} /></Card>
        <Card><Stat label="Expectancy" value={`${t.expectancyR >= 0 ? '+' : ''}${t.expectancyR.toFixed(2)}R`} tone={t.expectancyR >= 0 ? 'bull' : 'bear'} /></Card>
        <Card><Stat label="Profit factor" value={t.profitFactor !== null ? t.profitFactor.toFixed(2) : '—'} tone="accent" /></Card>
      </div>

      <Card className="mt-6">
        <CardTitle hint="By instrument">Breakdown</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Index</th>
                <th className="px-3 py-2 font-medium">Family</th>
                <th className="px-3 py-2 text-right font-medium">Trades</th>
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
