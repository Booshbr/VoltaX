'use client';

/**
 * Client-side paper-account store. Persists to localStorage and stays in sync
 * across components via useSyncExternalStore. This is the single-user, no-database
 * home for paper trades; when Supabase is configured, the same PaperAccount shape
 * persists server-side instead (spec §17, §70 multi-user ready).
 */
import { useSyncExternalStore } from 'react';
import {
  createAccount,
  openTrade,
  markAccount,
  closeTrade,
  type PaperAccount,
  type OpenTradeInput,
} from '@/lib/trading/paper';

const KEY = 'voltax-paper-account';
const EMPTY = createAccount();

function load(): PaperAccount {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return createAccount();
    const parsed = JSON.parse(raw) as PaperAccount;
    if (!parsed || !Array.isArray(parsed.trades)) return createAccount();
    return parsed;
  } catch {
    return createAccount();
  }
}

let account: PaperAccount = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // ignore quota/private-mode errors
  }
}

function set(next: PaperAccount) {
  account = next;
  persist();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const paperActions = {
  open(input: OpenTradeInput) {
    // One open position per symbol at a time (keeps the demo desk legible).
    const hasOpen = account.trades.some(
      (t) => t.symbol === input.symbol && t.status === 'open',
    );
    if (hasOpen) return;
    set({ ...account, trades: [...account.trades, openTrade(input)] });
  },
  /** Mark all open trades to market, auto-closing any that hit stop/TP. */
  mark(priceMap: Record<string, number>, now: string) {
    const next = markAccount(account, priceMap, now);
    if (next.trades.some((t, i) => t.status !== account.trades[i]?.status)) set(next);
  },
  closeManual(id: string, price: number, now: string) {
    set({
      ...account,
      trades: account.trades.map((t) =>
        t.id === id && t.status === 'open' ? closeTrade(t, price, now, 'closed') : t,
      ),
    });
  },
  reset(startingEquity = 10_000) {
    set(createAccount(startingEquity));
  },
};

export function usePaperAccount(): PaperAccount {
  return useSyncExternalStore(subscribe, () => account, () => EMPTY);
}
