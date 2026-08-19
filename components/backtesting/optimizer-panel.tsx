'use client';

import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui';
import { formatPercent } from '@/lib/utils/format';

interface WindowStats {
  trades: number;
  winRate: number | null;
  expectancyR: number;
}
interface Candidate {
  minimumRiskReward: number;
  inSample: WindowStats;
  outOfSample: WindowStats;
}
interface Report {
  baseline: Candidate;
  candidates: Candidate[];
  recommended: Candidate | null;
  meta: { symbols: number; trainFraction: number; minTrades: number };
}
interface ApiResult {
  ok: boolean;
  error?: string;
  currentRiskReward?: number;
  currentVersion?: string;
  report?: Report;
}

const R = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}R`;

/** Walk-forward optimizer (proposal only). Runs on demand; adoption is a separate,
 * human-approved, versioned change — this panel never alters the engine. */
export function OptimizerPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/optimize', { cache: 'no-store' });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: 'Request failed.' });
    } finally {
      setLoading(false);
    }
  }

  const report = result?.report;
  const rec = report?.recommended ?? null;
  const baseRR = result?.currentRiskReward ?? report?.baseline.minimumRiskReward;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle hint="Proposal only — nothing changes without your approval">Strategy optimizer (walk-forward)</CardTitle>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Optimizing… (up to a minute)' : 'Run optimization'}
        </button>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted">
        Optimizes the target reward:risk (<code className="text-fg">minimumRiskReward</code>) across all markets. It picks the best value on
        older <strong className="text-fg">in-sample</strong> data, then only recommends it if it also beats the current setting on newer{' '}
        <strong className="text-fg">out-of-sample</strong> data it was not chosen on — the guard against curve-fitting.
      </p>

      {result && !result.ok ? <p className="mt-3 text-sm text-bear">{result.error}</p> : null}

      {report ? (
        <>
          {rec ? (
            <div className="mt-4 rounded-md border border-bull/50 bg-bull/10 p-3 text-sm">
              <p className="font-bold text-bull">
                Proposal: change target R:R from {baseRR} to {rec.minimumRiskReward}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Out-of-sample expectancy {R(rec.outOfSample.expectancyR)} vs current {R(report.baseline.outOfSample.expectancyR)} over{' '}
                {rec.outOfSample.trades} unseen trades. This is a <strong className="text-fg">proposal</strong> — nothing has changed. To adopt,
                approve it and it is applied as a new versioned methodology (with the change re-backtested).
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-border bg-surface-2/50 p-3 text-sm text-muted">
              No parameter change generalised better out-of-sample. <strong className="text-fg">Keeping the current methodology is the
              evidence-based choice</strong> — the optimizer refuses to recommend a change that only looks good in-sample.
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Target R:R</th>
                  <th className="px-3 py-2 text-right font-medium">In-sample trades</th>
                  <th className="px-3 py-2 text-right font-medium">In-sample exp.</th>
                  <th className="px-3 py-2 text-right font-medium">Out-of-sample trades</th>
                  <th className="px-3 py-2 text-right font-medium">Out-of-sample exp.</th>
                </tr>
              </thead>
              <tbody>
                {report.candidates.map((c) => {
                  const isBase = c.minimumRiskReward === report.baseline.minimumRiskReward;
                  const isRec = rec?.minimumRiskReward === c.minimumRiskReward;
                  return (
                    <tr key={c.minimumRiskReward} className={`border-b border-border/60 last:border-0 ${isRec ? 'bg-bull/10' : ''}`}>
                      <td className="px-3 py-2 font-medium text-fg">
                        1 : {c.minimumRiskReward}
                        {isBase ? <span className="ml-2 text-[10px] text-muted">current</span> : null}
                        {isRec ? <span className="ml-2 text-[10px] font-bold text-bull">proposed</span> : null}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-muted">{c.inSample.trades}</td>
                      <td className={`tnum px-3 py-2 text-right ${c.inSample.expectancyR >= 0 ? 'text-bull' : 'text-bear'}`}>{R(c.inSample.expectancyR)}</td>
                      <td className="tnum px-3 py-2 text-right text-muted">{c.outOfSample.trades}</td>
                      <td className={`tnum px-3 py-2 text-right font-semibold ${c.outOfSample.expectancyR >= 0 ? 'text-bull' : 'text-bear'}`}>{R(c.outOfSample.expectancyR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-5 text-muted">
            {report.meta.symbols} markets · {formatPercent(report.meta.trainFraction * 100)} in-sample / {formatPercent((1 - report.meta.trainFraction) * 100)}{' '}
            out-of-sample · min {report.meta.minTrades} trades to qualify. Backtested on the look-ahead-safe engine; historical performance is not
            a guarantee. Adoption requires your explicit approval and bumps the methodology version.
          </p>
        </>
      ) : null}
    </Card>
  );
}
