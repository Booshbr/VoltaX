import { PageHeader } from '@/components/page';
import { Card, CardTitle, Dot } from '@/components/ui';
import { getDerivConfig, redactToken } from '@/lib/deriv/config';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata = { title: 'System Health — VoltaX' };

/** System health (spec §43). Reports configuration-derived status WITHOUT opening
 * live connections (fail-safe, no hangs). Connectivity is probed on demand. */
export default function SystemHealthPage() {
  const deriv = getDerivConfig();
  const supabase = isSupabaseConfigured();
  const telegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const ai = Boolean(process.env.AI_API_KEY);

  const components: { label: string; state: State; detail: string }[] = [
    { label: 'Signal engine', state: 'healthy', detail: 'Deterministic engine operational' },
    { label: 'Market data feed', state: deriv.hasToken ? 'healthy' : 'disabled', detail: deriv.hasToken ? 'Deriv feed configured' : 'Demo generator (no live feed)' },
    { label: 'Deriv connection', state: deriv.hasToken ? 'healthy' : 'disabled', detail: `${deriv.configured ? 'App id set' : 'Not configured'} · token ${redactToken(deriv.config?.token)}` },
    { label: 'Database (Supabase)', state: supabase ? 'healthy' : 'disabled', detail: supabase ? 'Configured' : 'Not configured — persistence disabled' },
    { label: 'Telegram alerts', state: telegram ? 'healthy' : 'disabled', detail: telegram ? 'Configured' : 'Not configured (optional)' },
    { label: 'AI explanations', state: ai ? 'healthy' : 'disabled', detail: ai ? 'Provider key set' : 'Not configured (optional)' },
    { label: 'Paper trading', state: 'healthy', detail: 'Available' },
    { label: 'Live trading', state: 'disabled', detail: 'Opt-in; requires Deriv account token + explicit enablement' },
  ];

  return (
    <>
      <PageHeader title="System Health" subtitle="Component status and configuration." />
      <Card>
        <CardTitle>Components</CardTitle>
        <ul className="divide-y divide-border">
          {components.map((c) => (
            <li key={c.label} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-medium text-fg">{c.label}</div>
                <div className="text-xs text-muted">{c.detail}</div>
              </div>
              <StateBadge state={c.state} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

type State = 'healthy' | 'degraded' | 'error' | 'disconnected' | 'disabled';

function StateBadge({ state }: { state: State }) {
  const map: Record<State, { tone: 'bull' | 'warn' | 'bear' | 'muted'; label: string }> = {
    healthy: { tone: 'bull', label: 'Healthy' },
    degraded: { tone: 'warn', label: 'Degraded' },
    error: { tone: 'bear', label: 'Error' },
    disconnected: { tone: 'bear', label: 'Disconnected' },
    disabled: { tone: 'muted', label: 'Disabled' },
  };
  const { tone, label } = map[state];
  return <Dot tone={tone} label={label} />;
}
