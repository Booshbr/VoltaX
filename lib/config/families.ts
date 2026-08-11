/**
 * Index-family profiles (spec §7). A profile system, not hard-coded logic, so
 * different synthetic-index families can carry specialised analytical behaviour.
 * Profiles are looked up by family; unknown families fall back to a safe default.
 */
import type { IndexFamily } from '@/lib/types';

export interface IndexFamilyProfile {
  family: IndexFamily;
  label: string;
  characteristics: string[];
  /** Multipliers applied to analytical sensitivity for this family. */
  volatilityModel: {
    /** Scales the ATR window baseline for this family. */
    atrScale: number;
    /** Threshold (in ATR multiples) that flags an abnormal move. */
    abnormalMoveAtr: number;
  };
  /** Per-family nudges to the structural quality read. */
  structureBias: number;
  /** Families like Boom/Crash spike in one direction — note the asymmetry. */
  spikeDirection: 'up' | 'down' | 'none';
}

const DEFAULT_PROFILE: IndexFamilyProfile = {
  family: 'unknown',
  label: 'Synthetic Index',
  characteristics: ['Generic synthetic index — default analytical profile applied.'],
  volatilityModel: { atrScale: 1, abnormalMoveAtr: 3 },
  structureBias: 0,
  spikeDirection: 'none',
};

const PROFILES: Partial<Record<IndexFamily, IndexFamilyProfile>> = {
  volatility: {
    family: 'volatility',
    label: 'Volatility Indices',
    characteristics: [
      'Constant, symmetric volatility with no directional drift bias.',
      'Structure-based analysis works well; mean-reversion within regimes is common.',
    ],
    volatilityModel: { atrScale: 1, abnormalMoveAtr: 3 },
    structureBias: 0,
    spikeDirection: 'none',
  },
  boom: {
    family: 'boom',
    label: 'Boom Indices',
    characteristics: [
      'Frequent small down-moves punctuated by sudden large upward spikes.',
      'Long setups must account for asymmetric spike risk against shorts.',
    ],
    volatilityModel: { atrScale: 1.2, abnormalMoveAtr: 4 },
    structureBias: 0.05,
    spikeDirection: 'up',
  },
  crash: {
    family: 'crash',
    label: 'Crash Indices',
    characteristics: [
      'Frequent small up-moves punctuated by sudden large downward spikes.',
      'Short setups must account for asymmetric spike risk against longs.',
    ],
    volatilityModel: { atrScale: 1.2, abnormalMoveAtr: 4 },
    structureBias: -0.05,
    spikeDirection: 'down',
  },
  jump: {
    family: 'jump',
    label: 'Jump Indices',
    characteristics: [
      'Periodic discrete jumps in addition to baseline volatility.',
      'Gap/jump detection matters more; ATR alone understates tail risk.',
    ],
    volatilityModel: { atrScale: 1.15, abnormalMoveAtr: 3.5 },
    structureBias: 0,
    spikeDirection: 'none',
  },
  step: {
    family: 'step',
    label: 'Step Indices',
    characteristics: [
      'Low, uniform step-based movement; tight ranges dominate.',
      'Favour smaller stops; large-move detection thresholds are lower.',
    ],
    volatilityModel: { atrScale: 0.8, abnormalMoveAtr: 2.5 },
    structureBias: 0,
    spikeDirection: 'none',
  },
  'range-break': {
    family: 'range-break',
    label: 'Range Break Indices',
    characteristics: [
      'Ranges that break after a number of touches — breakout logic is central.',
      'Failed-breakout detection is especially valuable here.',
    ],
    volatilityModel: { atrScale: 1, abnormalMoveAtr: 3 },
    structureBias: 0,
    spikeDirection: 'none',
  },
  'drift-switch': {
    family: 'drift-switch',
    label: 'Drift Switching Indices',
    characteristics: [
      'Directional drift that periodically switches — regime detection is critical.',
      'Trend-following works within a drift; watch for switches (CHOCH).',
    ],
    volatilityModel: { atrScale: 1, abnormalMoveAtr: 3 },
    structureBias: 0,
    spikeDirection: 'none',
  },
};

/** Resolve a profile, always returning a usable default for unknown families. */
export function getFamilyProfile(family: IndexFamily): IndexFamilyProfile {
  return PROFILES[family] ?? { ...DEFAULT_PROFILE, family };
}

/**
 * Classify a provider symbol into a family. Best-effort heuristic over Deriv
 * naming — the authoritative family still comes from provider metadata where
 * available; this is only a fallback classifier (spec §7).
 */
export function classifyFamily(symbol: string, displayName = ''): IndexFamily {
  const s = `${symbol} ${displayName}`.toLowerCase();
  if (s.includes('boom')) return 'boom';
  if (s.includes('crash')) return 'crash';
  if (s.includes('jump')) return 'jump';
  if (s.includes('step')) return 'step';
  if (s.includes('range') && s.includes('break')) return 'range-break';
  if (s.includes('drift') || s.includes('dsi')) return 'drift-switch';
  if (/\br_?\d+/.test(s) || s.includes('volatility') || s.includes('vol ')) {
    return 'volatility';
  }
  return 'unknown';
}
