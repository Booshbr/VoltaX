/**
 * Live risk guardrails (spec §18, §20). Pure evaluation of exposure and daily-loss
 * limits against the conservative StrategyConfig thresholds, so the dashboard and
 * the auto-disable both read from one tested source. No martingale, no risk-after-
 * loss — breaching a limit only ever HALTS, never scales up.
 */
export interface GuardrailLimits {
  /** Max simultaneous open risk as a fraction of equity (StrategyConfig.maxOpenRisk). */
  maxOpenRisk: number;
  /** Max cumulative daily loss as a fraction of equity (StrategyConfig.maxDailyRisk). */
  maxDailyRisk: number;
  /** Max simultaneous open positions (StrategyConfig.maxOpenTrades). */
  maxOpenTrades: number;
}

export interface GuardrailInput {
  equity: number;
  /** Capital currently committed to open contracts (sum of buy prices). */
  openStake: number;
  openCount: number;
  /** Realised P/L so far today; negative is a loss. */
  dailyRealizedPnl: number;
  limits: GuardrailLimits;
}

export interface GuardrailState {
  exposurePct: number;
  exposureLimitPct: number;
  exposureBreached: boolean;

  dailyLossPct: number;
  dailyLossLimitPct: number;
  dailyLossBreached: boolean;

  openCount: number;
  maxOpenTrades: number;
  openCountBreached: boolean;

  /** True when any hard limit is breached — new trades must be blocked. */
  anyBreached: boolean;
  /** True when the daily-loss limit is breached — live trading should auto-disable. */
  shouldAutoDisable: boolean;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

export function evaluateGuardrails(input: GuardrailInput): GuardrailState {
  const { equity, openStake, openCount, dailyRealizedPnl, limits } = input;

  const exposurePct = pct(Math.max(0, openStake), equity);
  const exposureBreached = exposurePct >= limits.maxOpenRisk;

  const dailyLoss = Math.max(0, -dailyRealizedPnl);
  const dailyLossPct = pct(dailyLoss, equity);
  const dailyLossBreached = dailyLossPct >= limits.maxDailyRisk;

  const openCountBreached = openCount >= limits.maxOpenTrades;

  return {
    exposurePct,
    exposureLimitPct: limits.maxOpenRisk,
    exposureBreached,
    dailyLossPct,
    dailyLossLimitPct: limits.maxDailyRisk,
    dailyLossBreached,
    openCount,
    maxOpenTrades: limits.maxOpenTrades,
    openCountBreached,
    anyBreached: exposureBreached || dailyLossBreached || openCountBreached,
    shouldAutoDisable: dailyLossBreached,
  };
}
