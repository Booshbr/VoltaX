/**
 * Supply/demand & support/resistance zones (spec §6 zones). Zones are anchored at
 * confirmed swing points; a swing high seeds a supply/resistance zone, a swing low
 * a demand/support zone. Touch counts measure how often price reacted, feeding
 * zone strength into setup quality.
 */
import type { Candle, SwingPoint, Zone } from '@/lib/types';

export interface ZoneOptions {
  /** Zone half-thickness as a fraction of the swing price (default 0.05%). */
  thicknessPct?: number;
  /** Maximum zones to keep (most recent). */
  maxZones?: number;
}

/** Build zones from swings and count subsequent touches. */
export function detectZones(
  candles: Candle[],
  swings: SwingPoint[],
  options: ZoneOptions = {},
): Zone[] {
  const thicknessPct = options.thicknessPct ?? 0.0005;
  const maxZones = options.maxZones ?? 8;

  const zones: Zone[] = swings.map((s) => {
    const half = s.price * thicknessPct;
    const top = s.price + half;
    const bottom = s.price - half;
    let touches = 0;
    for (let i = s.index + 1; i < candles.length; i++) {
      const c = candles[i]!;
      if (c.low <= top && c.high >= bottom) touches++;
    }
    return {
      kind: s.type === 'high' ? 'supply' : 'demand',
      top,
      bottom,
      originIndex: s.index,
      touches,
    } satisfies Zone;
  });

  return zones.slice(-maxZones);
}

/** The nearest zone of a given side to `price`, or null. */
export function nearestZone(
  zones: Zone[],
  price: number,
  kind: Zone['kind'],
): Zone | null {
  let best: Zone | null = null;
  let bestDist = Infinity;
  for (const z of zones) {
    if (z.kind !== kind) continue;
    const mid = (z.top + z.bottom) / 2;
    const dist = Math.abs(mid - price);
    if (dist < bestDist) {
      bestDist = dist;
      best = z;
    }
  }
  return best;
}
