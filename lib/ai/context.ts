/**
 * Build a SignalExplanationContext from an engine evaluation (spec §68). Pure:
 * copies only validated numeric/enum facts. No prices or statistics are invented.
 */
import type { EngineEvaluation } from '@/lib/signals/engine';
import type { SignalExplanationContext } from './types';

export function buildExplanationContext(e: EngineEvaluation): SignalExplanationContext {
  return {
    instrument: e.instrumentSymbol,
    family: e.family,
    direction: e.direction,
    status: e.status,
    qualified: e.qualified,
    methodologyVersion: e.methodologyVersion,
    htf: { bias: e.htf.bias, regime: e.htf.regime, volatility: e.htf.volatility },
    mtf: { bias: e.mtf.bias, regime: e.mtf.regime },
    setup: {
      status: e.setup.status,
      type: e.setup.setupType,
      confluence: e.setup.confluence,
    },
    entry: { confirmed: e.entry.confirmed, momentum: e.entry.momentum },
    precision: { triggered: e.precision.triggered },
    risk: e.risk
      ? {
          entry: e.risk.entry,
          stopLoss: e.risk.stopLoss,
          takeProfits: e.risk.takeProfits.map((t) => t.price),
          riskReward: e.risk.riskReward,
        }
      : null,
    reliability: {
      score: e.reliability.score,
      sampleSize: e.reliability.sampleSize,
      winRate: e.reliability.winRate,
      sufficient: e.reliability.sufficient,
    },
    opportunityScore: e.opportunityScore,
    rejectionReason: e.rejectionReason,
  };
}
