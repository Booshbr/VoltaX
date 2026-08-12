/**
 * Live order execution (spec §18, §19, §42). SERVER-SIDE ONLY. This is the ONLY
 * path that places a real Deriv trade, and it refuses to do so unless the full
 * safety pipeline approves. Uses Deriv multiplier contracts whose monetary
 * stop-loss / take-profit directly bound the money at risk.
 *
 * ⚠️ Real money. Validate on a Deriv DEMO (virtual) account token before using a
 * real-money token — the contract's exact price triggers depend on the chosen
 * multiplier and may differ from the analysis levels (spec §75, §76).
 */
import { DerivClient, type MultiplierOrderParams } from './client';
import { getDerivConfig } from './config';
import { evaluateLiveExecution, type LiveExecutionContext, type SafetyResult } from '@/lib/trading/live-safety';
import { getLiveState } from '@/lib/trading/live-controller';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';
import { initialGuardState } from '@/lib/trading/risk';
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { DataQualityStatus, Instrument } from '@/lib/types';

/** Default multiplier when the symbol's list isn't queried. Overridable via env. */
const DEFAULT_MULTIPLIER = Number(process.env.DERIV_MULTIPLIER ?? 100);

export interface ExecuteResult {
  ok: boolean;
  safety: SafetyResult;
  order?: { contractId: number; buyPrice: number; longcode: string; stake: number; stopLoss: number; takeProfit: number };
  error?: string;
  isVirtual?: boolean;
}

/**
 * Attempt to execute a signal as a live multiplier order. Runs every safety gate;
 * only places the order if approved. `confirmed` must be true (per-trade consent).
 */
export async function executeSignalOrder(
  evaluation: EngineEvaluation,
  instrument: Instrument,
  confirmed: boolean,
  feed: DataQualityStatus,
): Promise<ExecuteResult> {
  const cfg = getDerivConfig();
  const live = getLiveState();
  const riskConfig = DEFAULT_STRATEGY.risk;

  // A dedicated authorized connection (never the shared public-data client).
  let client: DerivClient | null = null;
  let balance = 0;
  let currency = 'USD';
  let isVirtual = true;
  let authorized = false;

  if (cfg.configured && cfg.config?.token) {
    try {
      client = new DerivClient(cfg.config);
      await client.connect();
      const acct = await client.authorize(cfg.config.token);
      balance = acct.balance;
      currency = acct.currency;
      isVirtual = acct.isVirtual;
      authorized = true;
    } catch {
      authorized = false;
    }
  }

  // Risk sizing from the REAL balance: risk budget = balance × per-trade risk.
  const riskAmount = Math.max(0, balance * riskConfig.perTradeRisk);
  const stake = Number(Math.max(riskAmount, 1).toFixed(2));
  const stopLoss = Number((riskAmount * 0.95).toFixed(2));
  const takeProfit = Number((riskAmount * (evaluation.riskReward || riskConfig.perTradeRisk)).toFixed(2));

  const safetyCtx: LiveExecutionContext = {
    evaluation,
    instrument,
    feed,
    live: {
      enabled: live.enabled,
      emergencyStop: live.emergencyStop,
      accountConnected: live.accountConnected,
      accountAuthorized: authorized,
    },
    risk: {
      config: riskConfig,
      guard: initialGuardState(),
      openPositions: 0,
      stake,
      minStake: 1,
      maxStake: Math.max(balance, 1),
      accountEquity: balance,
    },
    confirmed,
  };

  const safety = evaluateLiveExecution(safetyCtx);
  if (!safety.approved) {
    client?.close();
    return { ok: false, safety, isVirtual, error: safety.rejectionReasons.join('; ') };
  }

  // Approved — place the order.
  if (!client || !evaluation.direction) {
    client?.close();
    return { ok: false, safety, error: 'Execution client unavailable.' };
  }

  const params: MultiplierOrderParams = {
    symbol: instrument.symbol,
    direction: evaluation.direction,
    amount: stake,
    multiplier: DEFAULT_MULTIPLIER,
    currency,
    stopLoss,
    takeProfit,
  };

  try {
    const proposal = await client.proposeMultiplier(params);
    // Cap slippage at 1% above the quoted ask price.
    const order = await client.buyContract(proposal.id, proposal.askPrice * 1.01);
    client.close();
    return {
      ok: true,
      safety,
      isVirtual,
      order: { ...order, stake, stopLoss, takeProfit },
    };
  } catch (err) {
    client.close();
    return {
      ok: false,
      safety,
      isVirtual,
      error: err instanceof Error ? err.message : 'Order failed.',
    };
  }
}
