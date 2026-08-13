import Link from 'next/link';
import type { EngineEvaluation } from '@/lib/signals/engine';
import { Card, Badge, ScoreBar } from './ui';
import { DirectionBadge } from './domain';
import { formatPrice, formatPercent, formatRR, titleCase } from '@/lib/utils/format';

/** Reusable signal/opportunity card (spec §53). Shows the multi-timeframe read,
 * levels, reliability and opportunity score. Numbers are demo-data outputs. */
export function SignalCard({ evaluation }: { evaluation: EngineEvaluation }) {
  const e = evaluation;
  const tp1 = e.risk?.takeProfits[0]?.price;
  const tp2 = e.risk?.takeProfits[1]?.price;

  const rows: [string, string][] = [
    ['4H', titleCase(e.htf.bias)],
    ['1H', titleCase(e.mtf.bias)],
    ['15M', e.setup.status === 'none' ? '—' : titleCase(e.setup.status)],
    ['5M', e.entry.confirmed ? 'Confirmed' : '—'],
    ['1M', e.precision.triggered ? 'Precision' : '—'],
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-fg">{e.instrumentSymbol}</div>
          <div className="text-xs text-muted">{titleCase(e.family)} Indices</div>
        </div>
        <DirectionBadge direction={e.direction} />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-1.5 text-center">
        <MiniStat label="Reliability" value={formatPercent(e.reliability.score)} />
        <MiniStat label="Opportunity" value={`${e.opportunityScore}`} />
        <MiniStat label="R : R" value={formatRR(e.riskReward)} />
      </div>
      <ScoreBar value={e.opportunityScore} tone={e.direction === 'short' ? 'bear' : 'bull'} />

      <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
        {rows.map(([tf, val]) => (
          <div key={tf} className="rounded-lg border border-border/70 bg-surface-2 py-1.5">
            <div className="text-muted">{tf}</div>
            <div className="font-medium text-fg">{val}</div>
          </div>
        ))}
      </div>

      {e.risk ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Level label="Entry" value={formatPrice(e.risk.entry)} />
          <Level label="Stop" value={formatPrice(e.risk.stopLoss)} tone="bear" />
          <Level label="TP1" value={tp1 !== undefined ? formatPrice(tp1) : '—'} tone="bull" />
          <Level label="TP2" value={tp2 !== undefined ? formatPrice(tp2) : '—'} tone="bull" />
        </dl>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <Badge tone={e.qualified ? 'accent' : 'muted'}>
          {e.qualified ? 'Qualified' : titleCase(e.status)}
        </Badge>
        <Link
          href={`/signals/${e.instrumentSymbol}`}
          className="text-xs font-medium text-accent hover:underline"
        >
          View analysis →
        </Link>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="tnum text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function Level({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'bull' | 'bear';
}) {
  const c = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-fg';
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`tnum font-medium ${c}`}>{value}</dd>
    </div>
  );
}
