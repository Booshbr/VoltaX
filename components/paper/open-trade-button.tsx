'use client';

import { useState } from 'react';
import { paperActions, usePaperAccount } from './store';
import type { TradeableSignal } from './types';

/** Opens a paper trade from a signal. Idempotent per symbol (one open at a time). */
export function OpenTradeButton({
  signal,
  methodologyVersion,
  className,
}: {
  signal: TradeableSignal;
  methodologyVersion: string;
  className?: string;
}) {
  const account = usePaperAccount();
  const [flash, setFlash] = useState(false);
  const alreadyOpen = account.trades.some(
    (t) => t.symbol === signal.symbol && t.status === 'open',
  );

  function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `pt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function onClick() {
    paperActions.open({
      id: genId(),
      symbol: signal.symbol,
      direction: signal.direction,
      size: signal.size,
      entryPrice: signal.entry,
      stopLoss: signal.stop,
      takeProfit: signal.takeProfit,
      reliabilityAtEntry: signal.reliability,
      methodologyVersion,
      now: new Date().toISOString(),
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={alreadyOpen}
      className={
        className ??
        'inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {alreadyOpen ? 'Position open' : flash ? 'Opened ✓' : 'Paper trade'}
    </button>
  );
}
