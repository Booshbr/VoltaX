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
import { dispatchQualifiedAlertsPersistent } from '@/lib/notifications/dispatch';
import type { QualifiedSignalInput } from '@/lib/notifications/inapp';

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
    return NextResponse.json({
      ok: true,
      source: view.source,
      qualified: signals.length,
      ...result,
    });
  } catch (err) {
    // Never surface an internal failure as a 500 storm to the scheduler.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'alert run failed' },
      { status: 200 },
    );
  }
}
