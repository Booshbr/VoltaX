import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle } from '@/components/ui';
import { getDerivConfig } from '@/lib/deriv/config';

export const metadata = { title: 'Live Trading — VoltaX' };

/** Live trading (spec §18, §42). Opt-in, multi-gated, with a prominent emergency
 * stop. Live execution is disabled until a Deriv account token is configured AND
 * the user explicitly enables it — never automatically. */
export default function LiveTradingPage() {
  const deriv = getDerivConfig();
  const canEnable = deriv.hasToken;

  return (
    <>
      <PageHeader title="Live Trading" subtitle="Opt-in real execution with independent safety layers." />

      <Card className="mb-4 border-bear/50 bg-bear/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-bear">Emergency stop</div>
            <p className="text-xs text-muted">Immediately halts all new trade execution.</p>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-bear/50 bg-bear/20 px-4 py-2 text-sm font-bold text-bear opacity-70"
            title="Available once live trading is configured"
          >
            STOP ALL TRADING
          </button>
        </div>
      </Card>

      {!canEnable ? (
        <ConfigNotice title="Live trading is not configured">
          A Deriv account API token is required and must be stored server-side
          (DERIV_API_TOKEN). The token is never exposed to the browser. Once configured,
          live trading still requires explicit, per-session enablement — VoltaX never
          switches from paper to live automatically.
        </ConfigNotice>
      ) : null}

      <Card className="mt-4">
        <CardTitle>Pre-execution safety checks</CardTitle>
        <ul className="space-y-1.5 text-sm text-muted">
          {[
            'Live trading explicitly enabled by the user',
            'Risk limits valid (per-trade, daily, open exposure)',
            'Deriv account connected and authorized',
            'Instrument and contract valid',
            'Market data fresh (not stale)',
            'Signal still valid at execution time',
            'Position and exposure limits respected',
          ].map((s) => (
            <li key={s} className="flex gap-2"><span className="text-muted">☐</span>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">If any critical check fails: no trade.</p>
      </Card>
    </>
  );
}
