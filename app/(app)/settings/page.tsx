import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getUserRiskSettings } from '@/lib/supabase/repositories/settings';
import { SignOutButton } from '@/components/sign-out-button';
import { RiskSettingsForm } from '@/components/settings/risk-settings-form';

export const metadata = { title: 'Settings — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabaseOn = isSupabaseConfigured();
  const user = supabaseOn ? await getCurrentUser() : null;
  const riskSettings = user ? await getUserRiskSettings() : null;
  return (
    <>
      <PageHeader title="Settings" subtitle="Trading, signals, notifications and appearance." />

      {!user ? (
        <div className="mb-4">
          <ConfigNotice title="Sign in to edit settings">
            Per-user settings are saved once you sign in with Supabase Auth (see docs/SETUP.md).
            Until then, the conservative defaults apply.
          </ConfigNotice>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardTitle hint="Applies to live execution only">Risk &amp; execution</CardTitle>
          {riskSettings ? (
            <RiskSettingsForm initial={riskSettings} />
          ) : (
            <p className="text-sm text-muted">Sign in to customise per-trade risk, stake, limits and multiplier.</p>
          )}
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
          {supabaseOn ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-fg">{user?.email ?? 'Signed in'}</div>
                  <div className="text-xs text-muted">Supabase Auth active</div>
                </div>
                <Badge tone="bull">Authenticated</Badge>
              </div>
              <SignOutButton />
            </div>
          ) : (
            <p className="text-sm text-muted">
              Single-user deployment. Login / logout / password reset activate once
              Supabase Auth is configured (see docs/SETUP.md).
            </p>
          )}
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
