import { getPerformance } from '@/lib/market/source';
import { getOutcomeStats } from '@/lib/supabase/repositories/outcomes';
import { getDailyPnlHistory } from '@/lib/deriv/positions';
import { PageHeader, Disclaimer, SourceBadge } from '@/components/page';
import { Card, CardTitle, Stat } from '@/components/ui';
import { DailyPnlChart } from '@/components/live/daily-pnl-chart';
import { formatPercent, titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Performance — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function PerformancePage() {
  const [perf, outcomes, dailyPnl] = await Promise.all([getPerformance(), getOutcomeStats(), getDailyPnlHistory(14)]);
  const t = perf.totals;
  const hasDailyPnl = dailyPnl.some((d) => d.pnl !== 0);

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle="Backtested performance across the scanned universe (look-ahead safe)."
        actions={<SourceBadge source={perf.source} />}
      />

      {outcomes && outcomes.total > 0 ? (
        <Card className="mb-6">
          <CardTitle hint="Real qualified signals, resolved against live price">
            Live signal outcomes
          </CardTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tracked" value={outcomes.total} />
            <Stat label="Resolved" value={outcomes.wins + outcomes.losses + outcomes.expired} />
            <Stat label="Pending" value={outcomes.pending} tone="accent" />
            <Stat label="Win rate" value={outcomes.winRate !== null ? formatPercent(outcomes.winRate * 100) : '—'} tone="bull" />
            <Stat
              label="Reliability (Wilson)"
              value={outcomes.wilsonLower !== null ? formatPercent(outcomes.wilsonLower * 100) : '—'}
            />
            <Stat
              label="Expectancy"
              value={`${outcomes.expectancyR >= 0 ? '+' : ''}${outcomes.expectancyR.toFixed(2)}R`}
              tone={outcomes.expectancyR >= 0 ? 'bull' : 'bear'}
            />
          </div>
          {outcomes.families.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Family</th>
                    <th className="px-3 py-2 text-right font-medium">Decided</th>
                    <th className="px-3 py-2 text-right font-medium">Win rate</th>
                    <th className="px-3 py-2 text-right font-medium">Reliability</th>
                    <th className="px-3 py-2 text-right font-medium">Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.families.map((f) => (
                    <tr key={f.family} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-medium text-fg">{titleCase(f.family)}</td>
                      <td className="tnum px-3 py-2 text-right">{f.decided}</td>
                      <td className="tnum px-3 py-2 text-right">{f.winRate !== null ? formatPercent(f.winRate * 100) : '—'}</td>
                      <td className="tnum px-3 py-2 text-right">{f.wilsonLower !== null ? formatPercent(f.wilsonLower * 100) : '—'}</td>
                      <td className={`tnum px-3 py-2 text-right ${f.expectancyR >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {f.expectancyR >= 0 ? '+' : ''}{f.expectancyR.toFixed(2)}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-muted">
            Measured from real qualified signals resolved against live candles (first target vs. stop;
            a bar touching both counts as the stop). Win rate excludes still-open and expired signals.
            Reliability is the conservative Wilson lower bound — historical performance is not a guarantee.
          </p>
        </Card>
      ) : null}

      {hasDailyPnl ? (
        <Card className="mb-6">
          <CardTitle hint="Realised, closed Deriv contracts (UTC days)">Daily P/L history</CardTitle>
          <DailyPnlChart data={dailyPnl} />
        </Card>
      ) : null}

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
