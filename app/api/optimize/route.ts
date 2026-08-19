/**
 * On-demand walk-forward optimization (spec §9, §61). Session-gated (the proxy
 * requires a signed-in user). Heavy compute — runs the engine across the universe
 * for each candidate parameter — so it is triggered by an explicit button, never on
 * page load. Returns a PROPOSAL with in- and out-of-sample evidence; it changes
 * nothing. Adoption is a separate, human-approved, versioned code change.
 */
import { NextResponse } from 'next/server';
import { getLiveUniverseCandles } from '@/lib/deriv/live';
import { walkForwardOptimize } from '@/lib/backtesting/optimizer';
import { DEFAULT_STRATEGY } from '@/lib/config/strategy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const universe = await getLiveUniverseCandles();
    if (universe.length === 0) {
      return NextResponse.json({ ok: false, error: 'Live market data is required to optimize (none available).' });
    }
    const report = walkForwardOptimize({ universe });
    return NextResponse.json({
      ok: true,
      currentVersion: DEFAULT_STRATEGY.version,
      currentRiskReward: DEFAULT_STRATEGY.minimumRiskReward,
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Optimization failed.' },
      { status: 200 },
    );
  }
}
