/**
 * Live-trading safety pipeline (spec §18, §42, §76). Multiple INDEPENDENT gates
 * that must ALL pass before a real order is allowed. Pure and deterministic so it
 * is fully unit-tested. The rule is absolute: if any critical check fails, NO
 * TRADE. This never places an order itself — it only decides whether one is
 * permitted, and every gate defaults to the safe (blocking) answer.
 */
import type { DataQualityStatus, Instrument } from '@/lib/types';
import type { RiskConfig } from '@/lib/config/strategy';
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { RiskGuardState } from '@/lib/types';

export interface LiveExecutionContext {
  /** The signal the user is trying to execute. */
  evaluation: EngineEvaluation;
  instrument: Instrument;
  /** Current market-data freshness. */
  feed: DataQualityStatus;
  /** Global live-trading controller state. */
  live: {
    /** Live trading has been explicitly enabled by the user (never auto). */
    enabled: boolean;
    /** Emergency stop: when true, all new execution is halted. */
    emergencyStop: boolean;
    /** A Deriv account token is configured server-side. */
    accountConnected: boolean;
    /** The account was authorized this session (token verified). */
    accountAuthorized: boolean;
    /** If authorization failed, the provider's error message (for diagnostics). */
    authError?: string;
  };
  /** Risk state + config for exposure checks. */
  risk: {
    config: RiskConfig;
    guard: RiskGuardState;
    /** Currently open live positions. */
    openPositions: number;
    /** Proposed stake (deposit) for this order, in account currency. */
    stake: number;
    /** Money actually at risk on this order — the monetary stop-loss on the
     * multiplier contract, which caps the loss well below the full stake. Daily
     * and open-risk limits are measured against THIS, not the deposit. */
    riskAmount: number;
    /** Instrument stake bounds from provider metadata. */
    minStake: number;
    maxStake: number;
    /** Account equity/balance. */
    accountEquity: number;
  };
  /** User has explicitly confirmed THIS order (per-trade confirmation). */
  confirmed: boolean;
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  /** True when failing this check must block the trade (all are critical here). */
  critical: boolean;
  detail: string;
}

export interface SafetyResult {
  approved: boolean;
  checks: SafetyCheck[];
  rejectionReasons: string[];
}

/**
 * Run every gate. Order is deliberate: cheapest/most-fundamental first. Every
 * check is critical — the spec requires all to pass (spec §42).
 */
export function evaluateLiveExecution(ctx: LiveExecutionContext): SafetyResult {
  const checks: SafetyCheck[] = [];
  const add = (name: string, passed: boolean, detail: string) =>
    checks.push({ name, passed, critical: true, detail });

  // 1. Live trading explicitly enabled by the user (never automatic).
  add(
    'Live trading enabled',
    ctx.live.enabled,
    ctx.live.enabled ? 'Enabled by user' : 'Live trading is OFF — enable it explicitly',
  );

  // 2. Emergency stop must not be active.
  add(
    'Emergency stop clear',
    !ctx.live.emergencyStop,
    ctx.live.emergencyStop ? 'EMERGENCY STOP is active — all trading halted' : 'No halt active',
  );

  // 3. Account connected + authorized.
  add(
    'Account connected',
    ctx.live.accountConnected && ctx.live.accountAuthorized,
    ctx.live.accountConnected
      ? ctx.live.accountAuthorized
        ? 'Deriv account authorized'
        : `Token present but authorization failed${ctx.live.authError ? ` — ${ctx.live.authError}` : ''}`
      : 'No Deriv account token configured',
  );

  // 4. Instrument valid + tradable.
  add(
    'Instrument tradable',
    ctx.instrument.active,
    ctx.instrument.active ? `${ctx.instrument.symbol} is open` : `${ctx.instrument.symbol} is not tradable`,
  );

  // 5. Market data fresh (never trade on stale data, spec §39).
  const fresh = ctx.feed.quality === 'healthy' || ctx.feed.quality === 'delayed';
  add(
    'Market data fresh',
    fresh,
    fresh ? `Feed ${ctx.feed.quality}` : `Feed ${ctx.feed.quality} — will not trade on stale data`,
  );

  // 6. Signal still valid (qualified + directional right now).
  const signalValid = ctx.evaluation.qualified && ctx.evaluation.direction !== null && ctx.evaluation.risk !== null;
  add(
    'Signal still valid',
    signalValid,
    signalValid
      ? `Qualified ${ctx.evaluation.direction} signal`
      : `Signal not currently qualified (${ctx.evaluation.status})`,
  );

  // 7. Risk limits valid (per-trade, daily, open exposure, consecutive losses).
  const r = ctx.risk;
  const balanceOk = r.accountEquity > 0;
  // Risk is the money at stake (stop-loss), not the full multiplier deposit.
  const perTradeFraction = balanceOk ? r.riskAmount / r.accountEquity : Infinity;
  const dailyOk = r.guard.dailyRiskUsed + perTradeFraction <= r.config.maxDailyRisk + 1e-9;
  const openRiskOk = r.guard.openRiskExposure + perTradeFraction <= r.config.maxOpenRisk + 1e-9;
  const lossesOk = r.guard.consecutiveLosses < r.config.maxConsecutiveLosses;
  const notHalted = !r.guard.tradingHalted;
  const riskOk = balanceOk && dailyOk && openRiskOk && lossesOk && notHalted;
  add(
    'Risk limits valid',
    riskOk,
    !balanceOk
      ? 'Account balance unavailable (authorize the account first)'
      : riskOk
        ? 'Within per-trade, daily and open-risk limits'
        : [
            !notHalted && 'risk guard halted',
            !dailyOk && 'daily risk limit',
            !openRiskOk && 'open-risk limit',
            !lossesOk && 'consecutive-loss limit',
          ]
            .filter(Boolean)
            .join('; '),
  );

  // 8. Position/exposure limits.
  const posOk = r.openPositions < r.config.maxOpenTrades;
  add(
    'Position limit',
    posOk,
    posOk ? `${r.openPositions}/${r.config.maxOpenTrades} open` : 'Max open positions reached',
  );

  // 9. Stake within instrument bounds and > 0.
  const stakeOk = r.stake > 0 && r.stake >= r.minStake && r.stake <= r.maxStake;
  add(
    'Stake valid',
    stakeOk,
    stakeOk ? `Stake ${r.stake}` : `Stake ${r.stake} outside [${r.minStake}, ${r.maxStake}]`,
  );

  // 10. Explicit per-trade confirmation.
  add(
    'Trade confirmed',
    ctx.confirmed,
    ctx.confirmed ? 'User confirmed this order' : 'Awaiting explicit confirmation',
  );

  const failed = checks.filter((c) => c.critical && !c.passed);
  return {
    approved: failed.length === 0,
    checks,
    rejectionReasons: failed.map((c) => `${c.name}: ${c.detail}`),
  };
}
