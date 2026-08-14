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
import { getMarketDetail, getMarketView } from '@/lib/market/source';
import type { Instrument } from '@/lib/types';
import { classifyFamily } from '@/lib/config/families';
import { getDerivAccountSummary } from '@/lib/deriv/account';
import { closeLivePosition, closeAllLivePositions } from '@/lib/deriv/positions';

export async function enableLiveAction(): Promise<{ state: LiveControllerState; error?: string }> {
  const account = await getDerivAccountSummary();
  if (!account.connected) {
    return {
      state: await getLiveState(),
      error: account.error ?? 'Deriv account verification failed. Live trading remains off.',
    };
  }
  const res = await enableLive();
  revalidatePath('/live-trading');
  return { state: await getLiveState(), error: res.ok ? undefined : res.error };
}

export async function disableLiveAction(): Promise<LiveControllerState> {
  await disableLive();
  revalidatePath('/live-trading');
  return getLiveState();
}

export async function emergencyStopAction(): Promise<LiveControllerState> {
  await triggerEmergencyStop();
  revalidatePath('/live-trading');
  return getLiveState();
}

export async function clearEmergencyStopAction(): Promise<LiveControllerState> {
  await clearEmergencyStop();
  revalidatePath('/live-trading');
  return getLiveState();
}

/** Close one open Deriv contract at market. */
export async function closePositionAction(contractId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await closeLivePosition(contractId);
  revalidatePath('/live-trading');
  return { ok: res.ok, error: res.error };
}

/** Kill-switch: halt trading (emergency stop) AND close every open position. */
export async function killSwitchAction(): Promise<{ closed: number; failed: number }> {
  await triggerEmergencyStop();
  const result = await closeAllLivePositions();
  revalidatePath('/live-trading');
  return result;
}

/** Auto-disable live trading when the daily-loss guardrail is breached. Invoked by
 * the client dashboard; the execution safety pipeline blocks trades regardless. */
export async function enforceDailyLossGuardAction(): Promise<LiveControllerState> {
  await disableLive();
  revalidatePath('/live-trading');
  return getLiveState();
}

/** Execute a signal as a real order. `confirmed` MUST come from a deliberate
 * user confirmation — the safety pipeline blocks it otherwise. */
export async function executeOrderAction(symbol: string, confirmed: boolean): Promise<ExecuteResult | { error: string }> {
  const [detail, view] = await Promise.all([getMarketDetail(symbol), getMarketView()]);
  if (!detail) return { error: 'Signal not found.' };
  const e = detail.evaluation;
  const instrument: Instrument = {
    symbol: e.instrumentSymbol,
    displayName: e.instrumentSymbol,
    family: classifyFamily(e.instrumentSymbol),
    pip: 0.01,
    active: true,
  };
  return executeSignalOrder(e, instrument, confirmed, view.feed);
}
