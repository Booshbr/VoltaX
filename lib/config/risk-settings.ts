/**
 * User-overridable execution risk settings (spec §10, §20). These tune HOW a signal
 * is sized and gated for LIVE execution — they never touch the deterministic signal
 * engine. Every value is clamped to a conservative range, and martingale / risk-
 * after-loss remain structurally impossible.
 */
import type { RiskConfig } from '@/lib/config/strategy';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';

export interface RiskSettings {
  /** Fraction of balance risked per trade (drives the monetary stop-loss). */
  perTradeRisk: number;
  /** Max cumulative daily loss as a fraction of equity. */
  maxDailyRisk: number;
  /** Max simultaneous open risk as a fraction of equity. */
  maxOpenRisk: number;
  /** Max simultaneous open positions. */
  maxOpenTrades: number;
  /** Halt new trades after this many consecutive losses. */
  maxConsecutiveLosses: number;
  /** Deriv multiplier applied to the contract. */
  multiplier: number;
  /** Optional fixed deposit stake in account currency; null/0 = auto from risk %. */
  fixedStake: number | null;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  perTradeRisk: DEFAULT_STRATEGY.risk.perTradeRisk,
  maxDailyRisk: DEFAULT_STRATEGY.risk.maxDailyRisk,
  maxOpenRisk: DEFAULT_STRATEGY.risk.maxOpenRisk,
  maxOpenTrades: DEFAULT_STRATEGY.risk.maxOpenTrades,
  maxConsecutiveLosses: DEFAULT_STRATEGY.risk.maxConsecutiveLosses,
  multiplier: Number(process.env.DERIV_MULTIPLIER ?? 100),
  fixedStake: null,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Merge a partial (untrusted) override over the defaults, clamping every field to a
 * safe range. Unknown/invalid values fall back to the default. */
export function mergeRiskSettings(partial: Partial<RiskSettings> | null | undefined): RiskSettings {
  const p = partial ?? {};
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  const stake = p.fixedStake;
  return {
    perTradeRisk: clamp(num(p.perTradeRisk, DEFAULT_RISK_SETTINGS.perTradeRisk), 0.001, 0.1),
    maxDailyRisk: clamp(num(p.maxDailyRisk, DEFAULT_RISK_SETTINGS.maxDailyRisk), 0.005, 0.5),
    maxOpenRisk: clamp(num(p.maxOpenRisk, DEFAULT_RISK_SETTINGS.maxOpenRisk), 0.005, 0.5),
    maxOpenTrades: Math.round(clamp(num(p.maxOpenTrades, DEFAULT_RISK_SETTINGS.maxOpenTrades), 1, 20)),
    maxConsecutiveLosses: Math.round(clamp(num(p.maxConsecutiveLosses, DEFAULT_RISK_SETTINGS.maxConsecutiveLosses), 1, 20)),
    multiplier: Math.round(clamp(num(p.multiplier, DEFAULT_RISK_SETTINGS.multiplier), 1, 4000)),
    fixedStake: typeof stake === 'number' && Number.isFinite(stake) && stake > 0 ? clamp(stake, 0.35, 100000) : null,
  };
}

/** Project the execution-risk fields onto the RiskConfig shape the safety pipeline reads. */
export function toRiskConfig(s: RiskSettings): RiskConfig {
  return {
    perTradeRisk: s.perTradeRisk,
    maxDailyRisk: s.maxDailyRisk,
    maxOpenRisk: s.maxOpenRisk,
    maxConsecutiveLosses: s.maxConsecutiveLosses,
    maxOpenTrades: s.maxOpenTrades,
    allowMartingale: false,
  };
}
