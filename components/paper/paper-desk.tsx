'use client';

import { useEffect } from 'react';
import { paperActions, usePaperAccount } from './store';
import { OpenTradeButton } from './open-trade-button';
import type { TradeableSignal } from './types';
import { accountSummary, pnlAt, type PaperTrade } from '@/lib/trading/paper';
import { Card, CardTitle, Stat, Badge } from '@/components/ui';
import { formatMoney, formatPrice, formatPercent, titleCase } from '@/lib/utils/format';

/** The interactive paper-trading desk (spec §17). Marks positions against the
 * latest prices, auto-closes on stop/TP, and shows equity / P&L / drawdown. */
export function PaperDesk({
  signals,
  prices,
  methodologyVersion,
}: {
  signals: TradeableSignal[];
  prices: Record<string, number>;
  methodologyVersion: string;
}) {
  const account = usePaperAccount();

  // Mark to market (and auto-close any hit levels) whenever fresh prices arrive.
  useEffect(() => {
    paperActions.mark(prices, new Date().toISOString());
  }, [prices]);

  const summary = accountSummary(account, prices);
  const open = account.trades.filter((t) => t.status === 'open');
  const closed = account.trades
    .filter((t) => t.status !== 'open')
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card><Stat label="Equity" value={formatMoney(summary.equity)} /></Card>
        <Card><Stat label="Realized P/L" value={formatMoney(summary.realizedPnl)} tone={summary.realizedPnl >= 0 ? 'bull' : 'bear'} /></Card>
        <Card><Stat label="Open P/L" value={formatMoney(summary.unrealizedPnl)} tone={summary.unrealizedPnl >= 0 ? 'bull' : 'bear'} /></Card>
        <Card><Stat label="Open" value={summary.openCount} /></Card>
        <Card><Stat label="Win rate" value={summary.winRate !== null ? formatPercent(summary.winRate * 100) : '—'} /></Card>
        <Card><Stat label="Max drawdown" value={formatMoney(summary.maxDrawdown)} tone="warn" /></Card>
      </div>

      {/* Open positions */}
      <Card>
        <CardTitle hint={`${open.length} open`}>Open positions</CardTitle>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No open paper positions. Open one from a signal below.</p>
        ) : (
          <PositionsTable trades={open} prices={prices} closable />
        )}
      </Card>

      {/* Tradeable signals */}
      <Card>
        <CardTitle hint="Qualified first">Open a paper trade</CardTitle>
        {signals.length === 0 ? (
          <p className="text-sm text-muted">No directional signals available right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Index</th>
                  <th className="px-3 py-2 font-medium">Dir</th>
                  <th className="px-3 py-2 text-right font-medium">Entry</th>
                  <th className="px-3 py-2 text-right font-medium">Stop</th>
                  <th className="px-3 py-2 text-right font-medium">TP</th>
                  <th className="px-3 py-2 text-right font-medium">Reliability</th>
                  <th className="px-3 py-2 text-right font-medium">Size</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.symbol} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-fg">
                      {s.symbol}
                      {s.qualified ? <Badge tone="accent" className="ml-2">Qualified</Badge> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={s.direction === 'long' ? 'bull' : 'bear'}>{s.direction === 'long' ? 'LONG' : 'SHORT'}</Badge>
                    </td>
                    <td className="tnum px-3 py-2 text-right">{formatPrice(s.entry)}</td>
                    <td className="tnum px-3 py-2 text-right text-bear">{formatPrice(s.stop)}</td>
                    <td className="tnum px-3 py-2 text-right text-bull">{formatPrice(s.takeProfit)}</td>
                    <td className="tnum px-3 py-2 text-right">{formatPercent(s.reliability)}</td>
                    <td className="tnum px-3 py-2 text-right">{s.size.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <OpenTradeButton signal={s} methodologyVersion={methodologyVersion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* History */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle hint={`${closed.length} closed`}>Trade history</CardTitle>
          {account.trades.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset the paper account? This clears all paper trades.')) {
                  paperActions.reset(summary.startingEquity);
                }
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-fg"
            >
              Reset account
            </button>
          ) : null}
        </div>
        {closed.length === 0 ? (
          <p className="text-sm text-muted">No closed trades yet.</p>
        ) : (
          <PositionsTable trades={closed} prices={prices} />
        )}
      </Card>
    </div>
  );
}

function PositionsTable({
  trades,
  prices,
  closable = false,
}: {
  trades: PaperTrade[];
  prices: Record<string, number>;
  closable?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Index</th>
            <th className="px-3 py-2 font-medium">Dir</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">Entry</th>
            <th className="px-3 py-2 text-right font-medium">{closable ? 'Mark' : 'Exit'}</th>
            <th className="px-3 py-2 text-right font-medium">P/L</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {closable ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const mark = t.status === 'open' ? prices[t.symbol] ?? t.entryPrice : t.exitPrice ?? t.entryPrice;
            const pnl = t.status === 'open' ? pnlAt(t, mark) : t.realizedPnl ?? 0;
            const tone =
              t.status === 'won' ? 'bull' : t.status === 'lost' ? 'bear' : t.status === 'closed' ? 'neutral' : 'muted';
            return (
              <tr key={t.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium text-fg">{t.symbol}</td>
                <td className="px-3 py-2">
                  <Badge tone={t.direction === 'long' ? 'bull' : 'bear'}>{t.direction === 'long' ? 'LONG' : 'SHORT'}</Badge>
                </td>
                <td className="tnum px-3 py-2 text-right">{t.size.toFixed(2)}</td>
                <td className="tnum px-3 py-2 text-right">{formatPrice(t.entryPrice)}</td>
                <td className="tnum px-3 py-2 text-right">{formatPrice(mark)}</td>
                <td className={`tnum px-3 py-2 text-right ${pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{formatMoney(pnl)}</td>
                <td className="px-3 py-2"><Badge tone={tone}>{titleCase(t.status)}</Badge></td>
                {closable ? (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => paperActions.closeManual(t.id, prices[t.symbol] ?? t.entryPrice, new Date().toISOString())}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-fg"
                    >
                      Close
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
