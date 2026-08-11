import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle } from '@/components/ui';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';

export const metadata = { title: 'Settings — VoltaX' };

export default function SettingsPage() {
  const r = DEFAULT_STRATEGY.risk;
  return (
    <>
      <PageHeader title="Settings" subtitle="Trading, signals, notifications and appearance." />

      <div className="mb-4">
        <ConfigNotice title="Persistence requires Supabase">
          These are the current default configuration values. Saving per-user settings
          requires configuring Supabase (see docs/SETUP.md). Until then, defaults apply.
        </ConfigNotice>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Risk (defaults)</CardTitle>
          <dl className="space-y-1.5 text-sm">
            <Row label="Per-trade risk" value={`${(r.perTradeRisk * 100).toFixed(1)}%`} />
            <Row label="Max daily risk" value={`${(r.maxDailyRisk * 100).toFixed(1)}%`} />
            <Row label="Max open risk" value={`${(r.maxOpenRisk * 100).toFixed(1)}%`} />
            <Row label="Max open trades" value={`${r.maxOpenTrades}`} />
            <Row label="Max consecutive losses" value={`${r.maxConsecutiveLosses}`} />
            <Row label="Martingale" value={r.allowMartingale ? 'Enabled' : 'Disabled'} />
          </dl>
        </Card>

        <Card>
          <CardTitle>Signals (defaults)</CardTitle>
          <dl className="space-y-1.5 text-sm">
            <Row label="Minimum reliability" value={`${DEFAULT_STRATEGY.minimumReliability}`} />
            <Row label="Minimum R:R" value={`${DEFAULT_STRATEGY.minimumRiskReward}`} />
            <Row label="Minimum opportunity" value={`${DEFAULT_STRATEGY.minimumOpportunityScore}`} />
          </dl>
        </Card>

        <Card>
          <CardTitle>Appearance</CardTitle>
          <p className="text-sm text-muted">
            Toggle dark / light using the control in the top bar. Your choice is saved
            in the browser and applied before the first paint.
          </p>
        </Card>

        <Card>
          <CardTitle>Account</CardTitle>
          <p className="text-sm text-muted">
            Single-user deployment. Login / logout / password reset activate once
            Supabase Auth is configured.
          </p>
        </Card>
      </div>
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
