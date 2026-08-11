import { PageHeader } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { DEFAULT_STRATEGY, METHODOLOGY_VERSION } from '@/lib/config/strategy';

export const metadata = { title: 'Methodology — VoltaX' };

export default function MethodologyPage() {
  const c = DEFAULT_STRATEGY;
  return (
    <>
      <PageHeader
        title="Methodology"
        subtitle="How VoltaX analyzes markets, qualifies signals, and measures reliability."
        actions={<Badge tone="accent">{METHODOLOGY_VERSION}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>The decision pipeline</CardTitle>
          <ol className="space-y-1 text-sm text-muted">
            {[
              'Data freshness — stale feeds pause all new signals.',
              'Higher-timeframe structure (4H + 1H) must align and be non-neutral.',
              '15M setup: a pullback into a valid zone aligned with the bias.',
              '5M entry confirmation: local structure + momentum agree.',
              '1M precision: refines entry/stop (refinement, not a hard gate).',
              'Risk validation: geometry, R:R and risk guards.',
              'Statistical qualification: reliability + opportunity thresholds.',
            ].map((s, i) => (
              <li key={i} className="flex gap-2"><span className="text-accent">{i + 1}.</span>{s}</li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardTitle>Qualification thresholds</CardTitle>
          <dl className="space-y-1.5 text-sm">
            <Row label="Minimum reliability" value={`${c.minimumReliability}`} />
            <Row label="Minimum risk/reward" value={`${c.minimumRiskReward}`} />
            <Row label="Minimum opportunity score" value={`${c.minimumOpportunityScore}`} />
            <Row label="Max feed staleness" value={`${c.maxFeedStalenessMs / 1000}s`} />
          </dl>
          <p className="mt-3 text-xs text-muted">
            These are conservative, empirically-tunable starting points — not claimed
            as statistically optimal. They are versioned with the methodology.
          </p>
        </Card>

        <Card>
          <CardTitle>How reliability is calculated</CardTitle>
          <p className="text-sm text-muted">
            Reliability is a <strong>conservative statistical estimate</strong> (a Wilson
            score lower bound) of how often similar qualified setups historically reached
            their first target, drawn from a look-ahead-safe backtest. Small samples are
            shrunk toward a neutral prior and flagged as provisional. Reliability is never
            derived from &ldquo;several indicators agreeing.&rdquo;
          </p>
        </Card>

        <Card>
          <CardTitle>What AI does — and does not do</CardTitle>
          <ul className="space-y-1 text-sm text-muted">
            <li className="flex gap-2"><span className="text-bull">✓</span>Explains an already-made algorithmic decision in plain language.</li>
            <li className="flex gap-2"><span className="text-bear">✗</span>Generates buy/sell signals or invents price levels or statistics.</li>
            <li className="flex gap-2"><span className="text-bear">✗</span>Alters any numeric value produced by the deterministic engine.</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4 border-warn/40 bg-warn/5">
        <p className="text-sm text-muted">
          <strong className="text-fg">Disclaimer.</strong> VoltaX provides statistical,
          historical analysis for research and education. Statistical reliability and
          backtested performance are <strong>not a guarantee of future performance</strong>.
          Trading synthetic indices involves risk of loss. This is not financial advice.
        </p>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum font-medium text-fg">{value}</dd>
    </div>
  );
}
