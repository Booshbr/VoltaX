/**
 * Scheduled cloud alerts (spec §28, §29). Runs independently of any open browser:
 * Vercel Cron (or any external scheduler) hits this endpoint, it re-scans the
 * market through the SAME engine the UI uses, and dispatches Telegram alerts for
 * newly-qualified signals. De-duplication is persisted in Supabase so the same
 * signal does not re-alert every run.
 *
 * Security: if `CRON_SECRET` is set, the request must present it (Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; external schedulers may pass `?key=`).
 * Fail-safe: never throws to the caller and never places trades — alerts only.
 */
import { NextResponse } from 'next/server';
import { getMarketView } from '@/lib/market/source';
import { getLiveCandles } from '@/lib/deriv/live';
import { dispatchQualifiedAlertsPersistent, dispatchFeedStaleWarning } from '@/lib/notifications/dispatch';
import type { QualifiedSignalInput } from '@/lib/notifications/inapp';
import {
  recordPendingOutcomes,
  resolvePendingOutcomes,
  type OutcomeSeed,
} from '@/lib/supabase/repositories/outcomes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization') ?? '';
    const bearer = header.replace(/^Bearer\s+/i, '').trim();
    const query = new URL(request.url).searchParams.get('key') ?? '';
    if (bearer !== secret && query !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const view = await getMarketView();

    // Fail-safe (spec §4): on a stale feed, pause NEW alerts and warn once — never
    // emit signals off unreliable data.
    if (view.feed.quality === 'stale') {
      const warned = await dispatchFeedStaleWarning(view.feed.lastUpdateMs / 60_000);
      return NextResponse.json({
        ok: true,
        source: view.source,
        feedStale: true,
        warned,
        qualified: 0,
        sent: 0,
      });
    }

    const signals: QualifiedSignalInput[] = view.evaluations
      .filter((e) => e.qualified && e.direction && e.risk)
      .map((e) => ({
        symbol: e.instrumentSymbol,
        direction: e.direction as 'long' | 'short',
        reliability: e.reliability.score,
        opportunityScore: e.opportunityScore,
        riskReward: e.riskReward,
        entry: e.risk!.entry,
        stopLoss: e.risk!.stopLoss,
        takeProfits: e.risk!.takeProfits.map((target) => target.price),
        methodologyVersion: e.methodologyVersion,
      }));

    const result = await dispatchQualifiedAlertsPersistent(signals);

    // Track and resolve real signal outcomes (only from live data, to keep the
    // evidence base honest). Failures never break the alert run.
    let outcomes: { tracked: number; resolved: Awaited<ReturnType<typeof resolvePendingOutcomes>> } | null = null;
    try {
      if (view.source === 'live') {
        const seeds: OutcomeSeed[] = view.evaluations
          .filter((e) => e.qualified && e.direction && e.risk)
          .map((e) => ({
            symbol: e.instrumentSymbol,
            family: e.family,
            direction: e.direction as 'long' | 'short',
            entry: e.risk!.entry,
            stopLoss: e.risk!.stopLoss,
            takeProfit: e.risk!.takeProfits[0]?.price ?? e.risk!.entry,
            riskReward: e.riskReward,
            methodologyVersion: e.methodologyVersion,
            createdAtSec: Math.floor(Date.now() / 1000),
          }));
        const { inserted } = await recordPendingOutcomes(seeds);
        const resolved = await resolvePendingOutcomes((symbol) => getLiveCandles(symbol, '1m'));
        outcomes = { tracked: inserted, resolved };
      }
    } catch {
      // outcome tracking is best-effort
    }

    return NextResponse.json({
      ok: true,
      source: view.source,
      qualified: signals.length,
      ...result,
      outcomes,
    });
  } catch (err) {
    // Never surface an internal failure as a 500 storm to the scheduler.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'alert run failed' },
      { status: 200 },
    );
  }
}
