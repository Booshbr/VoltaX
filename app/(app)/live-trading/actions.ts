'use server';

/**
 * Live-trading control + execution actions (spec §18, §42). All state changes are
 * explicit and server-side. Execution runs the full safety pipeline and only
 * places a real order if every gate approves.
 */
import { revalidatePath } from 'next/cache';
import {
  getLiveState,
  enableLive,
  disableLive,
  triggerEmergencyStop,
  clearEmergencyStop,
  type LiveControllerState,
} from '@/lib/trading/live-controller';
import { executeSignalOrder, type ExecuteResult } from '@/lib/deriv/trading';
import { getMarketDetail } from '@/lib/market/source';
import type { Instrument } from '@/lib/types';
import { classifyFamily } from '@/lib/config/families';

export async function enableLiveAction(): Promise<{ state: LiveControllerState; error?: string }> {
  const res = enableLive();
  revalidatePath('/live-trading');
  return { state: getLiveState(), error: res.ok ? undefined : res.error };
}

export async function disableLiveAction(): Promise<LiveControllerState> {
  disableLive();
  revalidatePath('/live-trading');
  return getLiveState();
}

export async function emergencyStopAction(): Promise<LiveControllerState> {
  triggerEmergencyStop();
  revalidatePath('/live-trading');
  return getLiveState();
}

export async function clearEmergencyStopAction(): Promise<LiveControllerState> {
  clearEmergencyStop();
  revalidatePath('/live-trading');
  return getLiveState();
}

/** Execute a signal as a real order. `confirmed` MUST come from a deliberate
 * user confirmation — the safety pipeline blocks it otherwise. */
export async function executeOrderAction(symbol: string, confirmed: boolean): Promise<ExecuteResult | { error: string }> {
  const detail = await getMarketDetail(symbol);
  if (!detail) return { error: 'Signal not found.' };
  const e = detail.evaluation;
  const instrument: Instrument = {
    symbol: e.instrumentSymbol,
    displayName: e.instrumentSymbol,
    family: classifyFamily(e.instrumentSymbol),
    pip: 0.01,
    active: true,
  };
  return executeSignalOrder(e, instrument, confirmed);
}
