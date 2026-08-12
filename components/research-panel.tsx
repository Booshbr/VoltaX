import type { ResearchResult } from '@/lib/research/patterns';
import { Card, CardTitle, Stat, Badge } from './ui';
import { formatPercent } from '@/lib/utils/format';

/** Related historical patterns (spec §16, §24). Shows what happened AFTER the most
 * similar past conditions — framed as research, never a guarantee. */
export function ResearchPanel({ research, timeframe }: { research: ResearchResult; timeframe: string }) {
  const s = research.stats;
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

  return (
    <Card>
      <CardTitle hint={`${research.window}-bar shape · ${research.forward} bars forward`}>
        Related historical patterns
      </CardTitle>

      {!s ? (
        <p className="text-sm text-muted">
          Not enough history on the {timeframe} timeframe to find comparable past conditions yet.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Across <strong className="text-fg">{s.sampleSize}</strong> historically similar{' '}
            {timeframe} conditions, the market moved up{' '}
            <strong className="text-fg">{formatPercent(s.pctUp * 100)}</strong> of the time over the
            next {research.forward} bars, with an average change of{' '}
            <strong className={s.avgForwardReturn >= 0 ? 'text-bull' : 'text-bear'}>{pct(s.avgForwardReturn)}</strong>.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sample" value={s.sampleSize} />
            <Stat label="Moved up" value={formatPercent(s.pctUp * 100)} tone={s.pctUp >= 0.5 ? 'bull' : 'bear'} />
            <Stat label="Avg forward" value={pct(s.avgForwardReturn)} tone={s.avgForwardReturn >= 0 ? 'bull' : 'bear'} />
            <Stat label="Median" value={pct(s.medianForwardReturn)} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-1.5 font-medium">Similarity</th>
                  <th className="px-2 py-1.5 font-medium">Outcome</th>
                  <th className="px-2 py-1.5 text-right font-medium">Forward move</th>
                </tr>
              </thead>
              <tbody>
                {research.analogs.map((a) => (
                  <tr key={a.index} className="border-b border-border/60 last:border-0">
                    <td className="tnum px-2 py-1.5">{formatPercent(a.similarity * 100)}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={a.direction === 'up' ? 'bull' : a.direction === 'down' ? 'bear' : 'muted'}>
                        {a.direction}
                      </Badge>
                    </td>
                    <td className={`tnum px-2 py-1.5 text-right ${a.forwardReturn >= 0 ? 'text-bull' : 'text-bear'}`}>
                      {pct(a.forwardReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted">
            Best {pct(s.bestForwardReturn)} · worst {pct(s.worstForwardReturn)} · avg similarity{' '}
            {formatPercent(s.avgSimilarity * 100)}. Historically similar conditions are research only —
            they do <strong>not</strong> guarantee the market will repeat.
          </p>
        </>
      )}
    </Card>
  );
}
