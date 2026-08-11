/**
 * Setup engine — MODE B, 15M (spec §4 Mode B). A setup only qualifies when it
 * aligns with the higher-timeframe bias; the 15M read never overrides HTF context
 * on its own (spec §3 timeframe rule).
 */
import type {
  Bias,
  Candle,
  Direction,
  SetupAnalysis,
  SetupStatus,
} from '@/lib/types';
import { analyzeStructure } from './structure';
import { nearestZone } from './zones';
import { latestAtr } from './volatility';

const biasToDir = (b: Bias): Direction | null =>
  b === 'bullish' ? 'long' : b === 'bearish' ? 'short' : null;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface SetupOptions {
  atrPeriod?: number;
  abnormalMultiple?: number;
}

/**
 * Analyse the 15M timeframe for an actionable setup aligned with `htfBias`.
 */
export function analyzeSetup(
  candles: Candle[],
  htfBias: Bias,
  options: SetupOptions = {},
): SetupAnalysis {
  const structure = analyzeStructure(candles, '15m', {
    atrPeriod: options.atrPeriod,
    abnormalMultiple: options.abnormalMultiple,
  });
  const dir = biasToDir(htfBias);
  const last = candles[candles.length - 1];

  const base: SetupAnalysis = {
    timeframe: '15m',
    status: 'none',
    direction: null,
    setupType: null,
    zone: null,
    triggerLevel: null,
    invalidationLevel: structure.invalidationLevel,
    confluence: [],
    quality: 0,
  };

  // No HTF direction, no data, or abnormal volatility → no actionable setup.
  if (!dir || !last || structure.volatility === 'abnormal') {
    return base;
  }

  const confluence: string[] = [];
  const aligned = structure.bias === htfBias;
  if (aligned) confluence.push('15M structure aligned with higher timeframe');

  // Look for a pullback into an aligned zone (demand for long, supply for short).
  const zoneKind = dir === 'long' ? 'demand' : 'supply';
  const zone = nearestZone(structure.zones, last.close, zoneKind);
  const atr = latestAtr(candles, options.atrPeriod ?? 14) ?? 0;
  const nearZone =
    zone !== null && atr > 0
      ? Math.abs((zone.top + zone.bottom) / 2 - last.close) <= atr * 1.5
      : false;
  if (nearZone) confluence.push(`Price pulled back into ${zoneKind} zone`);

  const alignedEvent = structure.events.find(
    (e) => (dir === 'long' ? e.direction === 'long' : e.direction === 'short'),
  );
  if (alignedEvent) {
    confluence.push(`${alignedEvent.kind} confirmed on 15M`);
  }

  // Quality blends structure clarity, zone proximity and event confirmation.
  const quality = clamp01(
    structure.quality * 0.5 +
      (aligned ? 0.2 : 0) +
      (nearZone ? 0.2 : 0) +
      (alignedEvent ? 0.1 : 0),
  );

  let status: SetupStatus;
  if (!aligned) status = 'none';
  else if (nearZone && alignedEvent && quality >= 0.6) status = 'qualified';
  else if (nearZone || alignedEvent) status = 'forming';
  else status = 'none';

  const triggerLevel =
    dir === 'long'
      ? (structure.swings.filter((s) => s.type === 'high').at(-1)?.price ?? null)
      : (structure.swings.filter((s) => s.type === 'low').at(-1)?.price ?? null);

  return {
    ...base,
    status,
    direction: status === 'none' ? null : dir,
    setupType: aligned ? 'trend-continuation-pullback' : null,
    zone: nearZone ? zone : null,
    triggerLevel,
    confluence,
    quality,
  };
}
