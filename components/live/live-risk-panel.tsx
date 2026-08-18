'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode, type TransitionStartFunction } from 'react';
import type { LiveRiskSnapshot } from '@/lib/deriv/positions';
import type { GuardrailState } from '@/lib/trading/guardrails';
import { closePositionAction, killSwitchAction, enforceDailyLossGuardAction } from '@/app/(app)/live-trading/actions';
import { Card, CardTitle } from '@/components/ui';
import { formatMoney, formatPercent, formatSymbolName } from '@/lib/utils/format';

/** Risk guardrail dashboard + live positions (spec §18, §20). Visualises exposure
 * and daily-loss vs. the conservative limits, auto-disables live on a daily-loss
 * breach, and offers a kill-switch (halt + close all) plus per-position close. */
export function LiveRiskPanel({
  snapshot,
  guardrails,
  liveEnabled,
}: {
  snapshot: LiveRiskSnapshot;
  guardrails: GuardrailState;
  liveEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [autoDisabled, setAutoDisabled] = useState(false);
  const enforced = useRef(false);

  // Auto-disable live trading the moment the daily-loss guardrail is breached.
  useEffect(() => {
    if (guardrails.shouldAutoDisable && liveEnabled && !enforced.current) {
      enforced.current = true;
      startTransition(async () => {
        await enforceDailyLossGuardAction();
        setAutoDisabled(true);
      });
    }
  }, [guardrails.shouldAutoDisable, liveEnabled]);

  if (!snapshot.connected) {
    return (
      <Card>
        <CardTitle>Risk &amp; positions</CardTitle>
        <p className="text-sm text-muted">{snapshot.error ?? 'Connect a Deriv account to see live exposure and positions.'}</p>
      </Card>
    );
  }

  const pnlTone = snapshot.dailyRealizedPnl >= 0 ? 'text-bull' : 'text-bear';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle hint={snapshot.isVirtual ? 'Demo account' : 'Real account'}>Risk &amp; positions</CardTitle>
        <KillSwitch pending={pending} startTransition={startTransition} hasPositions={snapshot.positions.length > 0} />
      </div>

      {guardrails.anyBreached ? (
        <div className="mb-4 rounded-md border border-bear/50 bg-bear/10 p-3 text-xs font-semibold text-bear">
          {guardrails.dailyLossBreached
            ? `Daily loss limit reached (${formatPercent(guardrails.dailyLossPct * 100)} of equity). Live trading ${autoDisabled || !liveEnabled ? 'is disabled' : 'is being disabled'} and new trades are blocked until tomorrow.`
            : guardrails.exposureBreached
              ? 'Open-risk limit reached — no new positions until exposure falls.'
              : 'Maximum open positions reached — no new positions until one closes.'}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Meter
          label="Open risk"
          value={guardrails.exposurePct}
          limit={guardrails.exposureLimitPct}
          detail={`${formatMoney(snapshot.openRisk)} at risk of ${formatMoney(snapshot.balance)}`}
        />
        <Meter
          label="Daily loss"
          value={guardrails.dailyLossPct}
          limit={guardrails.dailyLossLimitPct}
          detail={
            <span className={pnlTone}>
              {snapshot.dailyRealizedPnl >= 0 ? '+' : ''}
              {formatMoney(snapshot.dailyRealizedPnl)} today
            </span>
          }
        />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Open positions</p>
          <p className="tnum mt-1 text-2xl font-semibold text-fg">
            {guardrails.openCount}
            <span className="text-base font-medium text-muted"> / {guardrails.maxOpenTrades}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{guardrails.openCountBreached ? 'At cap' : 'Within limit'}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Open contracts</p>
        {snapshot.positions.length === 0 ? (
          <p className="text-sm text-muted">No open positions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Contract</th>
                  <th className="px-3 py-2 text-right font-medium">Stake</th>
                  <th className="px-3 py-2 text-right font-medium">P/L</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.positions.map((p) => (
                  <PositionRow key={p.contractId} position={p} currency={snapshot.currency} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted">
        Limits are the conservative StrategyConfig thresholds (open-risk {formatPercent(guardrails.exposureLimitPct * 100)}, daily-loss{' '}
        {formatPercent(guardrails.dailyLossLimitPct * 100)}, {guardrails.maxOpenTrades} positions). Breaching a limit only ever halts new
        trades — VoltaX never increases risk after a loss. Trading synthetic indices carries risk of loss; this is not financial advice.
      </p>
    </Card>
  );
}

function Meter({ label, value, limit, detail }: { label: string; value: number; limit: number; detail: ReactNode }) {
  const ratio = limit > 0 ? Math.min(1, value / limit) : 0;
  const breached = value >= limit && limit > 0;
  const tone = breached ? 'bg-bear' : ratio > 0.66 ? 'bg-warn' : 'bg-bull';
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold text-fg">
        {formatPercent(value * 100)}
        <span className="text-base font-medium text-muted"> / {formatPercent(limit * 100)}</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function PositionRow({ position, currency }: { position: LiveRiskSnapshot['positions'][number]; currency: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    startTransition(async () => {
      const res = await closePositionAction(position.contractId);
      if (!res.ok) setError(res.error ?? 'Could not close.');
    });
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium text-fg">{formatSymbolName(position.symbol)}</span>
        <span className="ml-2 text-xs text-muted">#{position.contractId}</span>
        {error ? <span className="ml-2 text-xs text-bear">{error}</span> : null}
      </td>
      <td className="tnum px-3 py-2 text-right text-muted">{position.buyPrice.toFixed(2)} {currency}</td>
      <td className={`tnum px-3 py-2 text-right font-semibold ${position.profit >= 0 ? 'text-bull' : 'text-bear'}`}>
        {position.profit >= 0 ? '+' : ''}{position.profit.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending || !position.isValidToSell}
          onClick={close}
          title={position.isValidToSell ? 'Close at market' : 'Not currently sellable'}
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-fg hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Closing…' : 'Close'}
        </button>
      </td>
    </tr>
  );
}

function KillSwitch({
  pending,
  startTransition,
  hasPositions,
}: {
  pending: boolean;
  startTransition: TransitionStartFunction;
  hasPositions: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function fire() {
    startTransition(async () => {
      const r = await killSwitchAction();
      setResult(`Halted. Closed ${r.closed} position${r.closed === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.`);
      setConfirm(false);
    });
  }

  if (result) return <span className="text-xs font-semibold text-bear">{result}</span>;

  return confirm ? (
    <span className="flex items-center gap-2">
      <button type="button" disabled={pending} onClick={fire} className="rounded-md bg-bear px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90 disabled:opacity-50">
        {pending ? 'Halting…' : 'Confirm: halt & close all'}
      </button>
      <button type="button" disabled={pending} onClick={() => setConfirm(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-surface-2">
        Cancel
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="rounded-md border border-bear/60 bg-bear/15 px-3 py-1.5 text-xs font-bold uppercase text-bear hover:bg-bear/25"
    >
      {hasPositions ? 'Kill switch — halt & close all' : 'Kill switch — halt trading'}
    </button>
  );
}
