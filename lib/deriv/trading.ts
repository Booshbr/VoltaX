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
import type { MultiplierOrderParams } from './client';
import { getDerivConfig } from './config';
import { DerivAccountSocket } from './account';
import type { DerivBalanceResponse, DerivBuyResponse, DerivProposalResponse } from './types';
import { evaluateLiveExecution, type LiveExecutionContext, type SafetyResult } from '@/lib/trading/live-safety';
import { getLiveState } from '@/lib/trading/live-controller';
import { getUserRiskSettings } from '@/lib/supabase/repositories/settings';
import { toRiskConfig } from '@/lib/config/risk-settings';
import { initialGuardState } from '@/lib/trading/risk';
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { DataQualityStatus, Instrument } from '@/lib/types';

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
  const live = await getLiveState();
  const settings = await getUserRiskSettings();
  const riskConfig = toRiskConfig(settings);

  // A dedicated authorized connection (never the shared public-data client).
  let client: DerivAccountSocket | null = null;
  let balance = 0;
  let currency = 'USD';
  let isVirtual = true;
  let authorized = false;
  let authError: string | undefined;

  if (cfg.hasAccount) {
    try {
      client = await DerivAccountSocket.open();
      const accountBalance = await client.request<DerivBalanceResponse>({ balance: 1 });
      if (!accountBalance.balance) throw new Error('Deriv returned no account balance');
      balance = accountBalance.balance.balance;
      currency = accountBalance.balance.currency;
      isVirtual = client.isVirtual;
      authorized = true;
    } catch (err) {
      authorized = false;
      authError = err instanceof Error ? err.message : 'authorization failed';
      client?.close();
      client = null;
    }
  } else {
    authError = 'Configure DERIV_API_TOKEN and DERIV_ACCOUNT_ID for the target account.';
  }

  // Risk sizing from the REAL balance: risk budget = balance × per-trade risk.
  // The deposit stake is either the user's fixed stake or the auto amount (>= $1).
  const riskAmount = Math.max(0, balance * settings.perTradeRisk);
  const autoStake = Math.max(riskAmount, 1);
  const stake = Number((settings.fixedStake ?? autoStake).toFixed(2));
  // Money at risk (stop-loss) never exceeds the deposit.
  const stopLoss = Number(Math.min(riskAmount * 0.95, stake * 0.95).toFixed(2));
  const takeProfit = Number((riskAmount * (evaluation.riskReward || settings.perTradeRisk)).toFixed(2));

  const safetyCtx: LiveExecutionContext = {
    evaluation,
    instrument,
    feed,
    live: {
      enabled: live.enabled,
      emergencyStop: live.emergencyStop,
      accountConnected: live.accountConnected,
      accountAuthorized: authorized,
      authError,
    },
    risk: {
      config: riskConfig,
      guard: initialGuardState(),
      openPositions: 0,
      stake,
      // The monetary stop-loss is the real money at risk on a multiplier contract.
      riskAmount: stopLoss,
      minStake: 1,
      maxStake: Math.max(balance, 1),
      accountEquity: balance,
    },
    confirmed,
  };

  const safety = evaluateLiveExecution(safetyCtx);
  if (!safety.approved) {
    client?.close();
    const prefix = authError ? `Deriv authorization failed: ${authError}. ` : '';
    return { ok: false, safety, isVirtual, error: prefix + safety.rejectionReasons.join('; ') };
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
    multiplier: settings.multiplier,
    currency,
    stopLoss,
    takeProfit,
  };

  try {
    const proposalResponse = await client.request<DerivProposalResponse>({
      proposal: 1,
      amount: params.amount,
      basis: 'stake',
      contract_type: params.direction === 'long' ? 'MULTUP' : 'MULTDOWN',
      currency: params.currency,
      // The new Deriv Options API keys the instrument as `underlying_symbol`
      // (confirmed by probe: `symbol` is rejected as "Properties not allowed").
      underlying_symbol: params.symbol,
      multiplier: params.multiplier,
      limit_order: { stop_loss: params.stopLoss, take_profit: params.takeProfit },
    });
    if (!proposalResponse.proposal) throw new Error('Deriv returned no multiplier proposal');
    // Cap slippage at 1% above the quoted ask price.
    const buyResponse = await client.request<DerivBuyResponse>({
      buy: proposalResponse.proposal.id,
      price: proposalResponse.proposal.ask_price * 1.01,
    });
    if (!buyResponse.buy) throw new Error('Deriv returned no order confirmation');
    const order = {
      contractId: buyResponse.buy.contract_id,
      buyPrice: buyResponse.buy.buy_price,
      longcode: buyResponse.buy.longcode,
    };
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
