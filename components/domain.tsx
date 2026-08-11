import type {
  Bias,
  Direction,
  SignalStatus,
  VolatilityCondition,
} from '@/lib/types';
import { Badge } from './ui';
import { titleCase } from '@/lib/utils/format';

/** Beginner glossary (spec §52). Used with <InfoTip>. */
export const GLOSSARY: Record<string, string> = {
  BOS: 'Break of Structure — price moved beyond a previous important swing point, suggesting the current market structure may be changing.',
  CHOCH:
    'Change of Character — the first structure break against the prevailing trend, an early hint the trend may be shifting.',
  'R:R': 'Risk-to-Reward — how much you aim to gain versus how much you risk. 1:2 means risking 1 to potentially make 2.',
  Reliability:
    'A conservative, statistical estimate of how often similar qualified setups historically reached their first target. It is NOT a guarantee of future results.',
  Opportunity:
    'A standardized 0–100 ranking score combining structure, setup, entry, reliability, risk/reward and market conditions. It ranks opportunities; it is not a probability of profit.',
  Structure:
    'The higher-timeframe (4H/1H) market context: trend, swing points and key levels that set the directional bias.',
  Setup: 'A 15-minute actionable pattern (e.g. a pullback into a valid zone) aligned with the higher-timeframe bias.',
  Precision: 'A 1-minute refinement of an already-qualified setup to optimise the entry and reduce stop distance.',
};

export function DirectionBadge({ direction }: { direction: Direction | null }) {
  if (!direction) return <Badge tone="neutral">No bias</Badge>;
  return direction === 'long' ? (
    <Badge tone="bull">▲ LONG</Badge>
  ) : (
    <Badge tone="bear">▼ SHORT</Badge>
  );
}

export function BiasBadge({ bias }: { bias: Bias }) {
  const tone = bias === 'bullish' ? 'bull' : bias === 'bearish' ? 'bear' : 'neutral';
  return <Badge tone={tone}>{titleCase(bias)}</Badge>;
}

export function StatusBadge({ status }: { status: SignalStatus }) {
  const tone =
    status === 'qualified'
      ? 'accent'
      : status === 'active' || status === 'tp1' || status === 'tp2'
        ? 'bull'
        : status === 'developing'
          ? 'warn'
          : status === 'stopped' || status === 'invalidated'
            ? 'bear'
            : 'muted';
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

export function VolatilityBadge({ condition }: { condition: VolatilityCondition }) {
  const tone =
    condition === 'abnormal' ? 'bear' : condition === 'elevated' ? 'warn' : condition === 'low' ? 'muted' : 'neutral';
  return <Badge tone={tone}>{titleCase(condition)} vol</Badge>;
}
