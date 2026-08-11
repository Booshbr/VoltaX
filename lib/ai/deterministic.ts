/**
 * Deterministic explanation templater (spec §33). Produces a human-readable
 * SignalExplanation purely from structured facts — no LLM, no network, always
 * available. It is also the ground truth an AI provider must not contradict:
 * every sentence is derived from the context, never invented. Language avoids
 * guaranteed-profit framing (spec §2).
 */
import type { SignalExplanation, SignalExplanationContext } from './types';
import { formatPrice, formatPercent, formatRR, titleCase } from '@/lib/utils/format';

const dirWord = (d: 'long' | 'short' | null) =>
  d === 'long' ? 'long (buy)' : d === 'short' ? 'short (sell)' : 'no directional';

export function explainDeterministic(ctx: SignalExplanationContext): SignalExplanation {
  const dir = dirWord(ctx.direction);

  const summary = ctx.qualified
    ? `${ctx.instrument} presents a qualified ${dir} setup. The higher-timeframe context (${ctx.htf.bias} on 4H, ${ctx.mtf.bias} on 1H) aligns with a qualified 15M setup and a confirmed 5M entry, at a risk/reward of ${formatRR(ctx.risk?.riskReward ?? 0)} and a historical reliability estimate of ${formatPercent(ctx.reliability.score)}.`
    : `${ctx.instrument} is currently ${titleCase(ctx.status)} and is not a qualified ${dir} setup${ctx.rejectionReason ? `: ${ctx.rejectionReason.toLowerCase()}` : ''}. The analysis below explains what is present and what is still missing.`;

  const structure =
    ctx.htf.bias === 'neutral'
      ? `The 4H market structure reads neutral (${ctx.htf.regime} regime, ${ctx.htf.volatility} volatility), so there is no clear directional context to trade with yet.`
      : `The 4H structure is ${ctx.htf.bias} in a ${ctx.htf.regime} regime with ${ctx.htf.volatility} volatility, and the 1H structure is ${ctx.mtf.bias}. When both higher timeframes agree, VoltaX treats the directional context as ${ctx.direction ?? 'undecided'}.`;

  const setup =
    ctx.setup.status === 'qualified'
      ? `On the 15M timeframe the setup is qualified${ctx.setup.type ? ` (${ctx.setup.type.replace(/-/g, ' ')})` : ''}. Supporting factors: ${ctx.setup.confluence.length ? ctx.setup.confluence.join('; ') : 'none recorded'}.`
      : ctx.setup.status === 'none'
        ? 'No actionable 15M setup is present that aligns with the higher-timeframe context.'
        : `The 15M setup is ${titleCase(ctx.setup.status)} — forming but not yet meeting the qualification bar.`;

  const entry = ctx.entry.confirmed
    ? `The 5M timeframe confirms the entry: local structure and momentum (${ctx.entry.momentum.toFixed(2)}) both agree with the setup direction.${ctx.precision.triggered ? ' A 1M precision trigger further refined the entry and stop.' : ''}`
    : `The 5M entry is not yet confirmed (momentum ${ctx.entry.momentum.toFixed(2)}), so an execution trigger has not been met.`;

  const risk = ctx.risk
    ? `Based on the current read, entry is ${formatPrice(ctx.risk.entry)}, protective stop ${formatPrice(ctx.risk.stopLoss)}, and the first target ${ctx.risk.takeProfits[0] !== undefined ? formatPrice(ctx.risk.takeProfits[0]) : '—'} — a risk/reward of ${formatRR(ctx.risk.riskReward)}. Position size is derived from a conservative fixed fraction of account equity.`
    : 'No risk levels are calculated because the setup is not directional.';

  const reliability = ctx.reliability.winRate !== null
    ? `The reliability estimate is ${formatPercent(ctx.reliability.score)} — a conservative (Wilson lower-bound) view of how often similar setups reached their first target across ${ctx.reliability.sampleSize} backtested trades (raw hit rate ${formatPercent(ctx.reliability.winRate * 100)}). This is a statistical estimate, ${ctx.reliability.sufficient ? 'from a sufficient sample' : 'from a limited sample, so treat it as provisional'} — not a guarantee of future results.`
    : `There is not yet enough historical data to estimate reliability for this setup, so the score defaults to a neutral prior. Treat any figure as provisional.`;

  const invalidation = ctx.risk
    ? `The idea is invalidated if price trades through the stop at ${formatPrice(ctx.risk.stopLoss)}, or if the higher-timeframe structure changes character against the ${ctx.direction ?? 'expected'} direction.`
    : 'Invalidation is defined once a directional setup with risk levels forms.';

  return {
    summary,
    structure,
    setup,
    entry,
    risk,
    reliability,
    invalidation,
    source: 'deterministic',
  };
}
