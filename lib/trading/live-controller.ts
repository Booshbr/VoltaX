/**
 * Live-trading controller (spec §18, §42). SERVER-SIDE. Holds the global switches
 * that gate real execution: an explicit ENABLE flag (defaults OFF — VoltaX never
 * auto-switches paper→live) and an EMERGENCY STOP kill switch. State is in-memory
 * for this single-user build; a multi-user deployment would persist it per user
 * (e.g. `user_settings`) — the interface is the same either way.
 */
import { getDerivConfig } from '@/lib/deriv/config';

export interface LiveControllerState {
  /** Explicitly enabled by the user. Defaults OFF. */
  enabled: boolean;
  /** Emergency stop active → no new execution. */
  emergencyStop: boolean;
  /** A Deriv account token is configured server-side. */
  accountConnected: boolean;
  updatedAt: string;
}

// Module-level state (single-user). Both switches start in the safe position.
let enabled = false;
let emergencyStop = false;
let updatedAt = new Date(0).toISOString();

function stamp() {
  updatedAt = new Date().toISOString();
}

export function getLiveState(): LiveControllerState {
  return {
    enabled,
    emergencyStop,
    accountConnected: getDerivConfig().hasAccount,
    updatedAt,
  };
}

/** Enable live trading. Requires an account token — refuses otherwise. */
export function enableLive(): { ok: boolean; error?: string } {
  if (!getDerivConfig().hasAccount) {
    return { ok: false, error: 'Configure DERIV_API_TOKEN and DERIV_ACCOUNT_ID first.' };
  }
  if (emergencyStop) {
    return { ok: false, error: 'Clear the emergency stop before enabling live trading.' };
  }
  enabled = true;
  stamp();
  return { ok: true };
}

/** Disable live trading (returns to paper-only). */
export function disableLive(): void {
  enabled = false;
  stamp();
}

/** Trigger the emergency stop: halts all new execution and disables live trading. */
export function triggerEmergencyStop(): void {
  emergencyStop = true;
  enabled = false;
  stamp();
}

/** Clear the emergency stop. Live trading remains OFF until explicitly re-enabled. */
export function clearEmergencyStop(): void {
  emergencyStop = false;
  stamp();
}
