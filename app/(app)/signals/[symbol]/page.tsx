import { notFound } from 'next/navigation';
import { getDemoDetail } from '@/lib/demo/dataset';
import { DEMO_INSTRUMENTS } from '@/lib/demo/generator';
import { PageHeader, Disclaimer } from '@/components/page';
import { Card, CardTitle, Stat, Badge, ScoreBar, InfoTip } from '@/components/ui';
import { DirectionBadge, StatusBadge, BiasBadge, VolatilityBadge, GLOSSARY } from '@/components/domain';
import { CandleChart } from '@/components/candle-chart';
import { formatPrice, formatPercent, formatRR, titleCase } from '@/lib/utils/format';

export function generateStaticParams() {
  return DEMO_INSTRUMENTS.map((d) => ({ symbol: d.symbol }));
}

export default function SignalDetailPage({ params }: { params: { symbol: string } }) {
  const detail = getDemoDetail(params.symbol);
  if (!detail) notFound();
  const { evaluation: e, backtest, recentCandles } = detail;

  const levels = e.risk
    ? [
        { price: e.risk.entry, label: 'Entry', tone: 'accent' as const },
        { price: e.risk.stopLoss, label: 'Stop', tone: 'bear' as const },
        ...e.risk.takeProfits.map((t) => ({ price: t.price, label: `TP${t.level}`, tone: 'bull' as const })),
      ]
    : [];

  const supporting = e.reasons.filter((r) => r.polarity === 'supporting');
  const cautionary = e.reasons.filter((r) => r.polarity === 'cautionary');

  return (
    <>
      <PageHeader
        title={e.instrumentSymbol}
        subtitle={`${titleCase(e.family)} Indices · methodology ${e.methodologyVersion}`}
        actions={
          <div className="flex items-center gap-2">
            <DirectionBadge direction={e.direction} />
            <StatusBadge status={e.status} />
          </div>
        }
      />

      {/* Verdict banner */}
      <Card className={e.qualified ? 'border-accent/40 bg-accent/5' : 'border-warn/40 bg-warn/5'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            {e.qualified ? (
              <span className="font-medium text-accent">Qualified setup — all mandatory conditions met.</span>
            ) : (
              <span className="font-medium text-warn">
                Not yet qualified — {e.rejectionReason ?? 'conditions developing'}.
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <Stat label="Opportunity" value={`${e.opportunityScore}`} tone="accent" />
            <Stat label="Reliability" value={formatPercent(e.reliability.score)} />
            <Stat label="R : R" value={formatRR(e.riskReward)} />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Chart + levels */}
        <div className="lg:col-span-2">
          <Card>
            <CardTitle hint={`${detail.timeframe} · demo data`}>Price &amp; levels</CardTitle>
            <CandleChart candles={recentCandles} levels={levels} />
          </Card>
        </div>

        {/* Risk box */}
        <Card>
          <CardTitle>Risk calculation</CardTitle>
          {e.risk ? (
            <dl className="space-y-1.5 text-sm">
              <Row label="Entry" value={formatPrice(e.risk.entry)} />
              <Row label="Stop" value={formatPrice(e.risk.stopLoss)} tone="bear" />
              {e.risk.takeProfits.map((t) => (
                <Row key={t.level} label={`Take profit ${t.level}`} value={formatPrice(t.price)} tone="bull" />
              ))}
              <Row label="Stop distance" value={formatPrice(e.risk.stopDistance)} />
              <Row label={`Risk (${(e.risk.riskFraction * 100).toFixed(1)}%)`} value={formatPrice(e.risk.riskAmount)} />
              <Row label="Position size" value={e.risk.size.toFixed(2)} />
              {e.risk.rejected ? (
                <p className="pt-1 text-xs text-bear">{e.risk.rejectionReasons.join('; ')}</p>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted">No risk calculation — setup not directional.</p>
          )}
        </Card>
      </div>

      {/* Timeframe breakdown (spec §24, §54) */}
      <section className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TfCard title="4H — Market structure" term="Structure">
          <BiasBadge bias={e.htf.bias} /> <VolatilityBadge condition={e.htf.volatility} />
          <QualityRow label="Regime" value={titleCase(e.htf.regime)} score={e.htf.quality * 100} />
          <p className="text-xs text-muted">{e.htf.events.length} structure event(s), {e.htf.swings.length} swings.</p>
        </TfCard>
        <TfCard title="1H — Structure" term="Structure">
          <BiasBadge bias={e.mtf.bias} />
          <QualityRow label="Regime" value={titleCase(e.mtf.regime)} score={e.mtf.quality * 100} />
        </TfCard>
        <TfCard title="15M — Setup" term="Setup">
          <Badge tone={e.setup.status === 'qualified' ? 'accent' : e.setup.status === 'none' ? 'muted' : 'warn'}>
            {titleCase(e.setup.status)}
          </Badge>
          <QualityRow label="Quality" value={e.setup.setupType ?? '—'} score={e.setup.quality * 100} />
          {e.setup.confluence.length ? (
            <ul className="list-disc pl-4 text-xs text-muted">
              {e.setup.confluence.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          ) : null}
        </TfCard>
        <TfCard title="5M — Entry confirmation">
          <Badge tone={e.entry.confirmed ? 'bull' : 'muted'}>{e.entry.confirmed ? 'Confirmed' : 'Not confirmed'}</Badge>
          <QualityRow label="Momentum" value={e.entry.momentum.toFixed(2)} score={e.entry.quality * 100} />
        </TfCard>
        <TfCard title="1M — Precision" term="Precision">
          <Badge tone={e.precision.triggered ? 'bull' : 'muted'}>{e.precision.triggered ? 'Triggered' : 'Not triggered'}</Badge>
          <QualityRow label="Execution" value={e.precision.triggered ? 'Refined' : '—'} score={e.precision.quality * 100} />
        </TfCard>
        <TfCard title="Reliability" term="Reliability">
          <div className="tnum text-2xl font-semibold text-fg">{formatPercent(e.reliability.score)}</div>
          <p className="text-xs text-muted">
            {e.reliability.sufficient ? 'Sufficient' : 'Provisional'} sample · n = {e.reliability.sampleSize}
            {e.reliability.winRate !== null ? ` · raw win rate ${formatPercent(e.reliability.winRate * 100)}` : ''}
          </p>
        </TfCard>
      </section>

      {/* Why (spec §24, §54) */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Why VoltaX generated this read</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {supporting.map((r, i) => (
              <li key={i} className="flex gap-2"><span className="text-bull">✓</span><span>{r.text}</span></li>
            ))}
            {cautionary.map((r, i) => (
              <li key={`c${i}`} className="flex gap-2"><span className="text-warn">!</span><span className="text-muted">{r.text}</span></li>
            ))}
          </ul>
        </Card>

        {/* Backtest context (spec §24) */}
        <Card>
          <CardTitle hint="Same engine, replayed on history">Backtest context</CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Trades" value={backtest.trades.length} />
            <Stat label="Wins" value={backtest.wins} tone="bull" />
            <Stat label="Losses" value={backtest.losses} tone="bear" />
            <Stat
              label="Expectancy"
              value={`${backtest.expectancyR >= 0 ? '+' : ''}${backtest.expectancyR.toFixed(2)}R`}
              tone={backtest.expectancyR >= 0 ? 'bull' : 'bear'}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Reliability above is derived from this look-ahead-safe backtest, not asserted.
          </p>
        </Card>
      </div>

      <Disclaimer />
    </>
  );
}

function Row({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'bull' | 'bear' }) {
  const c = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-fg';
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`tnum font-medium ${c}`}>{value}</dd>
    </div>
  );
}

function QualityRow({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}: <span className="text-fg">{value}</span></span>
        <span className="tnum text-muted">{Math.round(score)}</span>
      </div>
      <ScoreBar value={score} />
    </div>
  );
}

function TfCard({ title, term, children }: { title: string; term?: string; children: React.ReactNode }) {
  const glossary = term ? GLOSSARY[term] : undefined;
  return (
    <Card>
      <div className="mb-2 text-sm font-semibold text-fg">
        {glossary ? <InfoTip term={title}>{glossary}</InfoTip> : title}
      </div>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}
