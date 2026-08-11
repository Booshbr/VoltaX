/**
 * Paper-trading domain engine (spec §17). Pure and deterministic — it mirrors live
 * behaviour (same signals, sizing, stops/TPs) but simulates execution. State lives
 * in a `PaperAccount`; marking to market and stop/TP resolution are pure functions
 * of a price, so the UI (or a future live loop) can drive it identically.
 *
 * Position P/L uses `valuePerUnit` for the instrument's contract value of a 1.0
 * price move per unit of size (defaults to 1). Deriv contract semantics must be
 * validated before real trading (spec §19) — this is the paper approximation.
 */
import type { Direction } from '@/lib/types';

export type PaperTradeStatus = 'open' | 'won' | 'lost' | 'closed';

export interface PaperTrade {
  id: string;
  symbol: string;
  direction: Direction;
  size: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  valuePerUnit: number;
  status: PaperTradeStatus;
  openedAt: string;
  closedAt: string | null;
  exitPrice: number | null;
  /** Realised P/L once closed, else null. */
  realizedPnl: number | null;
  reliabilityAtEntry: number;
  methodologyVersion: string;
}

export interface PaperAccount {
  startingEquity: number;
  trades: PaperTrade[];
}

export interface OpenTradeInput {
  id: string;
  symbol: string;
  direction: Direction;
  size: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  valuePerUnit?: number;
  reliabilityAtEntry: number;
  methodologyVersion: string;
  now: string;
}

export function createAccount(startingEquity = 10_000): PaperAccount {
  return { startingEquity, trades: [] };
}

export function openTrade(input: OpenTradeInput): PaperTrade {
  return {
    id: input.id,
    symbol: input.symbol,
    direction: input.direction,
    size: input.size,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    valuePerUnit: input.valuePerUnit ?? 1,
    status: 'open',
    openedAt: input.now,
    closedAt: null,
    exitPrice: null,
    realizedPnl: null,
    reliabilityAtEntry: input.reliabilityAtEntry,
    methodologyVersion: input.methodologyVersion,
  };
}

const sign = (d: Direction) => (d === 'long' ? 1 : -1);

/** P/L of a position at a given price (works for open or hypothetical exits). */
export function pnlAt(trade: PaperTrade, price: number): number {
  return (price - trade.entryPrice) * sign(trade.direction) * trade.size * trade.valuePerUnit;
}

/** Does `price` touch the stop or take-profit? Stop takes precedence (conservative). */
export function levelHit(
  trade: PaperTrade,
  price: number,
): 'stop' | 'tp' | null {
  if (trade.direction === 'long') {
    if (price <= trade.stopLoss) return 'stop';
    if (trade.takeProfit !== null && price >= trade.takeProfit) return 'tp';
  } else {
    if (price >= trade.stopLoss) return 'stop';
    if (trade.takeProfit !== null && price <= trade.takeProfit) return 'tp';
  }
  return null;
}

/** Close a trade at `price` with an explicit status. Returns a new trade. */
export function closeTrade(
  trade: PaperTrade,
  price: number,
  now: string,
  status: Exclude<PaperTradeStatus, 'open'>,
): PaperTrade {
  return {
    ...trade,
    status,
    exitPrice: price,
    closedAt: now,
    realizedPnl: pnlAt(trade, price),
  };
}

/**
 * Resolve an open trade against the current price: auto-close at stop/TP, else
 * leave open. Returns the (possibly unchanged) trade.
 */
export function resolveTrade(trade: PaperTrade, price: number, now: string): PaperTrade {
  if (trade.status !== 'open') return trade;
  const hit = levelHit(trade, price);
  if (hit === 'stop') return closeTrade(trade, trade.stopLoss, now, 'lost');
  if (hit === 'tp' && trade.takeProfit !== null) {
    return closeTrade(trade, trade.takeProfit, now, 'won');
  }
  return trade;
}

/** Apply market prices to all open trades, auto-closing any that hit levels. */
export function markAccount(
  account: PaperAccount,
  priceMap: Record<string, number>,
  now: string,
): PaperAccount {
  return {
    ...account,
    trades: account.trades.map((t) => {
      const price = priceMap[t.symbol];
      if (t.status !== 'open' || price === undefined) return t;
      return resolveTrade(t, price, now);
    }),
  };
}

export interface AccountSummary {
  startingEquity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
  openCount: number;
  closedCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  maxDrawdown: number;
}

/** Portfolio metrics from realised results + current marks (spec §17, §26). */
export function accountSummary(
  account: PaperAccount,
  priceMap: Record<string, number>,
): AccountSummary {
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let openCount = 0;
  let wins = 0;
  let losses = 0;
  let closedCount = 0;

  // Drawdown over the realised equity curve (trades in close order).
  const closed = account.trades
    .filter((t) => t.status !== 'open' && t.realizedPnl !== null)
    .sort((a, b) => (a.closedAt ?? '').localeCompare(b.closedAt ?? ''));

  let running = account.startingEquity;
  let peak = account.startingEquity;
  let maxDrawdown = 0;
  for (const t of closed) {
    realizedPnl += t.realizedPnl!;
    closedCount++;
    if (t.realizedPnl! >= 0) wins++;
    else losses++;
    running += t.realizedPnl!;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  for (const t of account.trades) {
    if (t.status !== 'open') continue;
    openCount++;
    const price = priceMap[t.symbol];
    if (price !== undefined) unrealizedPnl += pnlAt(t, price);
  }

  const decided = wins + losses;
  return {
    startingEquity: account.startingEquity,
    realizedPnl,
    unrealizedPnl,
    equity: account.startingEquity + realizedPnl + unrealizedPnl,
    openCount,
    closedCount,
    wins,
    losses,
    winRate: decided > 0 ? wins / decided : null,
    maxDrawdown,
  };
}
