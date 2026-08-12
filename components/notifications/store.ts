'use client';

/**
 * Client-side in-app notification store (spec §28, §30). localStorage-backed and
 * synced across components via useSyncExternalStore. Holds notification history +
 * a persisted set of seen event keys so a given event notifies at most once.
 */
import { useSyncExternalStore } from 'react';
import type { StoredNotification } from '@/lib/notifications/inapp';
import { selectNewQualified, type QualifiedSignalInput } from '@/lib/notifications/inapp';

const KEY = 'voltax-notifications';
const MAX = 100;

interface State {
  notifications: StoredNotification[];
  seenKeys: string[];
}

const EMPTY: State = { notifications: [], seenKeys: [] };

function load(): State {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { notifications: [], seenKeys: [] };
    const parsed = JSON.parse(raw) as State;
    if (!parsed || !Array.isArray(parsed.notifications)) return { notifications: [], seenKeys: [] };
    return { notifications: parsed.notifications, seenKeys: parsed.seenKeys ?? [] };
  } catch {
    return { notifications: [], seenKeys: [] };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota/private-mode errors
  }
}

function set(next: State) {
  state = next;
  persist();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `n_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const notificationActions = {
  /** Add any newly-qualified signals as notifications. Returns the ones added so
   * the caller can also fire a browser notification. */
  syncQualified(signals: QualifiedSignalInput[]): StoredNotification[] {
    const fresh = selectNewQualified(signals, state.seenKeys);
    if (fresh.length === 0) return [];
    const now = new Date().toISOString();
    const added: StoredNotification[] = fresh.map((f) => ({
      ...f.notification,
      id: genId(),
      key: f.key,
      read: false,
      createdAt: now,
    }));
    set({
      notifications: [...added, ...state.notifications].slice(0, MAX),
      seenKeys: [...new Set([...state.seenKeys, ...added.map((a) => a.key)])].slice(-MAX * 2),
    });
    return added;
  },
  markRead(id: string) {
    set({
      ...state,
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    });
  },
  markAllRead() {
    set({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) });
  },
  clear() {
    // Keep seenKeys so cleared events don't immediately re-notify.
    set({ notifications: [], seenKeys: state.seenKeys });
  },
};

export function useNotifications(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

export function useUnreadCount(): number {
  return useNotifications().notifications.filter((n) => !n.read).length;
}
