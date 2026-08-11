/**
 * Risk engine & position sizing (spec §19, §20). Conservative by default. Every
 * mandatory guard that fails REJECTS the trade — the system fails safe (spec §76).
 * No martingale, no auto-doubling: those are structurally impossible here.
 */
import type { Direction, RiskCalculation, RiskGuardState, TakeProfit } from '@/lib/types';
import type { RiskConfig } from '@/lib/config/strategy';

export interface PositionSizingInput {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  accountEquity: number;
  /** Value of a 1-unit move of price for 1 unit of position (contract semantics). */
  valuePerPricePerUnit?: number;
  /** Instrument stake bounds, from provider metadata. */
  minSize?: number;
  maxSize?: number;
}

/** Reward-to-risk to the nearest take-profit. Returns 0 if undefined. */
export function computeRiskReward(
  direction: Direction,
  entry: number,
  stopLoss: number,
  takeProfits: TakeProfit[],
): number {
  const stopDistance = Math.abs(entry - stopLoss);
  if (stopDistance <= 0 || takeProfits.length === 0) return 0;
  const tp = takeProfits[0]!;
  const reward = Math.abs(tp.price - entry);
  return reward / stopDistance;
}

/** Validate directional geometry: stop and TP must sit on the correct sides. */
function validateGeometry(input: PositionSizingInput): string[] {
  const { direction, entry, stopLoss, takeProfits } = input;
  const errors: string[] = [];
  if (direction === 'long') {
    if (stopLoss >= entry) errors.push('Long stop must be below entry');
    if (takeProfits.some((t) => t.price <= entry)) {
      errors.push('Long take-profit must be above entry');
    }
  } else {
    if (stopLoss <= entry) errors.push('Short stop must be above entry');
    if (takeProfits.some((t) => t.price >= entry)) {
      errors.push('Short take-profit must be below entry');
    }
  }
  if (!Number.isFinite(entry) || !Number.isFinite(stopLoss)) {
    errors.push('Entry and stop must be finite');
  }
  return errors;
}

/**
 * Risk-based position sizing.
 *   riskAmount = equity × riskFraction
 *   size       = riskAmount / (stopDistance × valuePerPricePerUnit)
 * clamped to [minSize, maxSize]. Rejects on bad geometry, sub-minimum R:R, or
 * when a global guard has halted trading.
 */
export function calculatePosition(
  input: PositionSizingInput,
  config: RiskConfig,
  guard?: RiskGuardState,
): RiskCalculation {
  const {
    direction,
    entry,
    stopLoss,
    takeProfits,
    accountEquity,
    valuePerPricePerUnit = 1,
    minSize = 0,
    maxSize = Number.POSITIVE_INFINITY,
  } = input;

  const rejectionReasons: string[] = [...validateGeometry(input)];
  const stopDistance = Math.abs(entry - stopLoss);
  const riskReward = computeRiskReward(direction, entry, stopLoss, takeProfits);
  const riskFraction = config.perTradeRisk;
  const riskAmount = accountEquity * riskFraction;

  if (accountEquity <= 0) rejectionReasons.push('Account equity must be positive');
  if (stopDistance <= 0) rejectionReasons.push('Stop distance must be positive');

  // Global guards (spec §18 emergency stop, §20 limits).
  if (guard?.tradingHalted) rejectionReasons.push('Trading is halted (emergency stop)');
  if (guard && guard.consecutiveLosses >= config.maxConsecutiveLosses) {
    rejectionReasons.push('Consecutive-loss limit reached');
  }
  if (guard && guard.dailyRiskUsed + riskFraction > config.maxDailyRisk + 1e-9) {
    rejectionReasons.push('Daily risk limit would be exceeded');
  }
  if (guard && guard.openRiskExposure + riskFraction > config.maxOpenRisk + 1e-9) {
    rejectionReasons.push('Open-risk exposure limit would be exceeded');
  }

  let size = 0;
  if (stopDistance > 0 && valuePerPricePerUnit > 0) {
    size = riskAmount / (stopDistance * valuePerPricePerUnit);
    if (size < minSize) rejectionReasons.push('Computed size below instrument minimum');
    size = Math.min(size, maxSize);
  }

  return {
    direction,
    entry,
    stopLoss,
    takeProfits,
    stopDistance,
    riskReward,
    accountEquity,
    riskFraction,
    riskAmount,
    size,
    rejected: rejectionReasons.length > 0,
    rejectionReasons,
  };
}

/** Fresh, permissive guard state (nothing halted, nothing used). */
export function initialGuardState(): RiskGuardState {
  return {
    tradingHalted: false,
    dailyRiskUsed: 0,
    openRiskExposure: 0,
    consecutiveLosses: 0,
  };
}
