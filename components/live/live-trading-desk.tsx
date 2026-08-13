'use client';

import { useState, useTransition } from 'react';
import {
  enableLiveAction,
  disableLiveAction,
  emergencyStopAction,
  clearEmergencyStopAction,
  executeOrderAction,
} from '@/app/(app)/live-trading/actions';
import type { LiveControllerState } from '@/lib/trading/live-controller';
import type { DerivAccountSummary } from '@/lib/deriv/account';
import { Card, CardTitle, Badge, Dot } from '@/components/ui';
import { formatPercent, formatRR } from '@/lib/utils/format';

export interface LiveSignal {
  symbol: string;
  direction: 'long' | 'short';
  reliability: number;
  opportunityScore: number;
  riskReward: number;
}

type ExecResult = Awaited<ReturnType<typeof executeOrderAction>>;

/** The live-trading control desk (spec §18, §42). Explicit enable, prominent
 * emergency stop, and a two-step confirm before any real order. */
export function LiveTradingDesk({
  initialState,
  hasToken,
  account,
  signals,
}: {
  initialState: LiveControllerState;
  hasToken: boolean;
  account: DerivAccountSummary;
  signals: LiveSignal[];
}) {
  const [state, setState] = useState<LiveControllerState>(initialState);
  const [pending, startTransition] = useTransition();
  const [controlError, setControlError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setControlError(null);
    startTransition(fn);
  }

  return (
    <div className="space-y-5">
      {/* Emergency stop — always visible, top priority */}
      <Card className="border-bear/50 bg-bear/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-bear">Emergency stop</div>
            <p className="text-xs text-muted">
              {state.emergencyStop
                ? 'ACTIVE — all new execution is halted. Live trading is off.'
                : 'Immediately halts all new trade execution and turns live trading off.'}
            </p>
          </div>
          {state.emergencyStop ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(async () => setState(await clearEmergencyStopAction()))}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-2 disabled:opacity-50"
            >
              Clear emergency stop
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(async () => setState(await emergencyStopAction()))}
              className="rounded-md border border-bear/60 bg-bear/20 px-4 py-2 text-sm font-bold uppercase text-bear hover:bg-bear/30 disabled:opacity-50"
            >
              STOP ALL TRADING
            </button>
          )}
        </div>
      </Card>

      {/* Status + enable */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardTitle>Status</CardTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted">Deriv account</span>
              <Dot tone={account.connected ? 'bull' : hasToken ? 'warn' : 'muted'} label={account.connected ? (account.isVirtual ? 'Demo account connected' : 'Real account connected') : hasToken ? 'Could not verify account' : 'Credential missing'} />
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Deriv balance</span>
              <span className="tnum text-sm font-semibold text-fg">
                {account.connected && account.balance !== undefined ? `${account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${account.currency}` : 'Unavailable'}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Live trading</span>
              {state.enabled ? (
                <Badge tone="bear">● LIVE — real money</Badge>
              ) : (
                <Badge tone="muted">Off (paper)</Badge>
              )}
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Emergency stop</span>
              <Dot tone={state.emergencyStop ? 'bear' : 'bull'} label={state.emergencyStop ? 'Active' : 'Clear'} />
            </li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Enable live trading</CardTitle>
          {!hasToken ? (
            <p className="text-sm text-muted">
              Configure <code className="text-fg">DERIV_API_TOKEN</code> and the target
              <code className="text-fg"> DERIV_ACCOUNT_ID</code> server-side to enable live
              trading. <strong className="text-fg">Use a Deriv demo (virtual) account first</strong> —
              it trades with fake money so you can validate execution safely.
            </p>
          ) : state.enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-bear">
                Live trading is ON. Real orders can be placed. Turn it off to return to paper-only.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(async () => setState(await disableLiveAction()))}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
              >
                Turn OFF live trading
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {!account.connected ? <p className="text-xs text-warn">Account verification failed: {account.error ?? 'check your Deriv token permissions and Vercel environment variables.'}</p> : null}
              <p className="text-sm text-muted">
                Turning this on allows real orders through your Deriv account. VoltaX never switches
                to live automatically — this is a deliberate action.
              </p>
              <button
                type="button"
                disabled={pending || state.emergencyStop}
                onClick={() =>
                  run(async () => {
                    const res = await enableLiveAction();
                    setState(res.state);
                    if (res.error) setControlError(res.error);
                  })
                }
                className="rounded-md border border-bear/60 bg-bear/15 px-4 py-2 text-sm font-bold text-bear hover:bg-bear/25 disabled:opacity-50"
              >
                Enable LIVE trading
              </button>
              {controlError ? <p className="text-xs text-bear">{controlError}</p> : null}
            </div>
          )}
        </Card>
      </div>

      {/* Qualified signals to execute */}
      <Card>
        <CardTitle hint={state.enabled ? 'Live — real orders' : 'Enable live trading to execute'}>
          Qualified signals
        </CardTitle>
        {signals.length === 0 ? (
          <p className="text-sm text-muted">No qualified signals right now — no trade is a valid result.</p>
        ) : (
          <ul className="space-y-2">
            {signals.map((s) => (
              <ExecuteRow key={s.symbol} signal={s} liveEnabled={state.enabled && !state.emergencyStop} />
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted">
        Every order passes an independent safety pipeline (live enabled, emergency stop clear, account
        authorized, instrument tradable, data fresh, signal valid, risk &amp; position limits, stake
        bounds, explicit confirmation). If any check fails, no trade is placed. Trading synthetic
        indices carries risk of loss; historical reliability is not a guarantee. This is not financial
        advice.
      </p>
    </div>
  );
}

function ExecuteRow({ signal, liveEnabled }: { signal: LiveSignal; liveEnabled: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'done'>('idle');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ExecResult | null>(null);

  function execute() {
    startTransition(async () => {
      const res = await executeOrderAction(signal.symbol, true);
      setResult(res);
      setPhase('done');
    });
  }

  return (
    <li className="rounded-md border border-border bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg">{signal.symbol}</span>
          <Badge tone={signal.direction === 'long' ? 'bull' : 'bear'}>
            {signal.direction === 'long' ? 'LONG' : 'SHORT'}
          </Badge>
          <span className="text-xs text-muted">
            Rel {formatPercent(signal.reliability)} · R:R {formatRR(signal.riskReward)} · Opp {signal.opportunityScore}
          </span>
        </div>
        {phase === 'idle' ? (
          <button
            type="button"
            disabled={!liveEnabled}
            onClick={() => setPhase('confirm')}
            title={liveEnabled ? 'Place a real order' : 'Enable live trading first'}
            className="rounded-md border border-bear/50 bg-bear/15 px-3 py-1.5 text-xs font-semibold text-bear hover:bg-bear/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Execute live
          </button>
        ) : null}
      </div>

      {phase === 'confirm' ? (
        <div className="mt-3 rounded-md border border-bear/40 bg-bear/10 p-3">
          <p className="text-sm text-fg">
            Place a <strong>real money</strong> {signal.direction} order on {signal.symbol}? Your
            configured per-trade risk applies as a monetary stop-loss.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={execute}
              className="rounded-md bg-bear px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Placing…' : 'Yes, place real order'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPhase('idle')}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'done' && result ? <ExecOutcome result={result} onDismiss={() => setPhase('idle')} /> : null}
    </li>
  );
}

function ExecOutcome({ result, onDismiss }: { result: ExecResult; onDismiss: () => void }) {
  if ('error' in result && !('safety' in result)) {
    return <p className="mt-2 text-xs text-bear">{result.error}</p>;
  }
  const r = result;
  return (
    <div className="mt-3 space-y-2">
      {r.ok && r.order ? (
        <div className="rounded-md border border-bull/40 bg-bull/10 p-2 text-xs text-bull">
          Order placed{r.isVirtual ? ' (virtual account)' : ''}: contract #{r.order.contractId}, stake{' '}
          {r.order.stake}, stop-loss {r.order.stopLoss}, take-profit {r.order.takeProfit}.
        </div>
      ) : (
        <div className="rounded-md border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
          No trade placed. {r.error}
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted">Safety checks</summary>
        <ul className="mt-1 space-y-0.5">
          {r.safety.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-1.5">
              <span className={c.passed ? 'text-bull' : 'text-bear'}>{c.passed ? '✓' : '✗'}</span>
              <span className="text-muted">
                <span className="text-fg">{c.name}</span> — {c.detail}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <button type="button" onClick={onDismiss} className="text-xs text-muted hover:text-fg">
        Dismiss
      </button>
    </div>
  );
}
