/** Risk & position-sizing types (spec §19, §20). */
import type { Direction } from './analysis';

export interface TakeProfit {
  level: number;
  price: number;
}

/**
 * Result of a risk-based position-sizing calculation. All monetary values are in
 * the account's base currency; `size` is expressed in the instrument's own units
 * (contract semantics are validated against the provider, spec §19).
 */
export interface RiskCalculation {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  /** Absolute price distance between entry and stop. */
  stopDistance: number;
  /** Reward-to-risk ratio to the first take-profit. */
  riskReward: number;
  /** Account equity used as the sizing basis. */
  accountEquity: number;
  /** Fraction of equity risked (e.g. 0.01 = 1%). */
  riskFraction: number;
  /** Currency amount at risk if the stop is hit. */
  riskAmount: number;
  /** Computed position size, clamped to instrument min/max. */
  size: number;
  /** True when a mandatory risk guard rejected the trade. */
  rejected: boolean;
  rejectionReasons: string[];
}

/** Global risk guard state (spec §20, §18 emergency stop). */
export interface RiskGuardState {
  /** Master kill switch: when true, no new trades may be opened. */
  tradingHalted: boolean;
  dailyRiskUsed: number;
  openRiskExposure: number;
  consecutiveLosses: number;
}
