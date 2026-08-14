/**
 * Live-trading controller. The opt-in state lives in secure cookies rather than
 * server memory, so it remains coherent when Vercel serves consecutive actions
 * from different function instances. It remains deliberately per-browser and
 * expires after eight hours; any new device starts safely in paper mode.
 */
import { cookies } from 'next/headers';
import { getDerivConfig } from '@/lib/deriv/config';

const LIVE_COOKIE = 'voltax-live-enabled';
const STOP_COOKIE = 'voltax-emergency-stop';
const STAMP_COOKIE = 'voltax-live-updated-at';
const MAX_AGE_SECONDS = 8 * 60 * 60;

export interface LiveControllerState {
  enabled: boolean;
  emergencyStop: boolean;
  accountConnected: boolean;
  updatedAt: string;
}

export async function getLiveState(): Promise<LiveControllerState> {
  const store = await cookies();
  const emergencyStop = store.get(STOP_COOKIE)?.value === '1';
  return {
    enabled: store.get(LIVE_COOKIE)?.value === '1' && !emergencyStop,
    emergencyStop,
    accountConnected: getDerivConfig().hasAccount,
    updatedAt: store.get(STAMP_COOKIE)?.value ?? new Date(0).toISOString(),
  };
}

export async function enableLive(): Promise<{ ok: boolean; error?: string }> {
  if (!getDerivConfig().hasAccount) return { ok: false, error: 'Configure DERIV_API_TOKEN and DERIV_ACCOUNT_ID first.' };
  const store = await cookies();
  if (store.get(STOP_COOKIE)?.value === '1') return { ok: false, error: 'Clear the emergency stop before enabling live trading.' };
  stamp(store);
  store.set(LIVE_COOKIE, '1', cookieOptions());
  return { ok: true };
}

export async function disableLive(): Promise<void> {
  const store = await cookies();
  stamp(store);
  store.set(LIVE_COOKIE, '0', cookieOptions());
}

export async function triggerEmergencyStop(): Promise<void> {
  const store = await cookies();
  stamp(store);
  store.set(STOP_COOKIE, '1', cookieOptions());
  store.set(LIVE_COOKIE, '0', cookieOptions());
}

export async function clearEmergencyStop(): Promise<void> {
  const store = await cookies();
  stamp(store);
  store.set(STOP_COOKIE, '0', cookieOptions());
  store.set(LIVE_COOKIE, '0', cookieOptions());
}

function stamp(store: Awaited<ReturnType<typeof cookies>>) {
  store.set(STAMP_COOKIE, new Date().toISOString(), cookieOptions());
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE_SECONDS };
}
