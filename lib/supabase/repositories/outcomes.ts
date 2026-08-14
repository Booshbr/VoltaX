/**
 * Signal-outcome persistence (spec §2, §26). The scheduled cron records each
 * qualified signal once (service-role) and later resolves it against real candles.
 * The Performance page reads the aggregate via the session client (RLS: authenticated
 * read). Everything degrades to a safe no-op / null when Supabase is not configured.
 */
import type { Candle } from '@/lib/types';
import { createAdminClient } from '../admin';
import { createClient } from '../server';
import {
  resolveOutcome,
  aggregateOutcomes,
  type OpenSignal,
  type OutcomeStats,
} from '@/lib/trading/outcomes';

/** One qualified signal to start tracking. */
export interface OutcomeSeed {
  symbol: string;
  family: string;
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  methodologyVersion: string;
  /** Decision time, unix seconds. */
  createdAtSec: number;
}

/** One tracked signal counts as a fresh instance per hour. */
const BUCKET_SECONDS = 3600;
/** Give a signal up to 4h of price action before it expires unresolved. */
const MAX_HORIZON_SECONDS = 4 * 3600;

function dedupKey(seed: OutcomeSeed): string {
  const bucket = Math.floor(seed.createdAtSec / BUCKET_SECONDS);
  return `${seed.symbol}:${seed.direction}:${seed.methodologyVersion}:${bucket}`;
}

/**
 * Insert any not-yet-tracked qualified signals as `pending`. Idempotent: the unique
 * `dedup_key` means re-running the cron within the same hour is a no-op.
 */
export async function recordPendingOutcomes(seeds: OutcomeSeed[]): Promise<{ inserted: number }> {
  const admin = createAdminClient();
  if (!admin || seeds.length === 0) return { inserted: 0 };

  const rows = seeds.map((s) => ({
    symbol: s.symbol,
    family: s.family,
    direction: s.direction,
    entry: s.entry,
    stop_loss: s.stopLoss,
    take_profit: s.takeProfit,
    risk_reward: s.riskReward,
    methodology_version: s.methodologyVersion,
    dedup_key: dedupKey(s),
  }));

  const { data, error } = await admin
    .from('signal_outcomes')
    .upsert(rows, { onConflict: 'dedup_key', ignoreDuplicates: true })
    .select('id');
  if (error) return { inserted: 0 };
  return { inserted: data?.length ?? 0 };
}

export interface ResolveSummary {
  checked: number;
  wins: number;
  losses: number;
  expired: number;
  stillPending: number;
}

/**
 * Resolve every `pending` outcome against forward candles. `fetchCandles` is injected
 * so this module stays decoupled from the Deriv layer; the cron passes the live feed.
 */
export async function resolvePendingOutcomes(
  fetchCandles: (symbol: string) => Promise<Candle[]>,
): Promise<ResolveSummary> {
  const summary: ResolveSummary = { checked: 0, wins: 0, losses: 0, expired: 0, stillPending: 0 };
  const admin = createAdminClient();
  if (!admin) return summary;

  const { data: pending, error } = await admin
    .from('signal_outcomes')
    .select('id, symbol, direction, entry, stop_loss, take_profit, created_at')
    .eq('status', 'pending')
    .limit(200);
  if (error || !pending?.length) return summary;

  // Fetch candles once per distinct symbol.
  const symbols = [...new Set(pending.map((p) => p.symbol))];
  const candleBySymbol = new Map<string, Candle[]>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        candleBySymbol.set(symbol, await fetchCandles(symbol));
      } catch {
        candleBySymbol.set(symbol, []);
      }
    }),
  );

  for (const row of pending) {
    summary.checked += 1;
    const candles = candleBySymbol.get(row.symbol) ?? [];
    if (candles.length === 0) {
      summary.stillPending += 1;
      continue;
    }
    const signal: OpenSignal = {
      direction: row.direction,
      entry: row.entry,
      stopLoss: row.stop_loss,
      takeProfit: row.take_profit,
      createdAtSec: Math.floor(new Date(row.created_at).getTime() / 1000),
    };
    const res = resolveOutcome(signal, candles, { maxHorizonSec: MAX_HORIZON_SECONDS });
    if (res.status === 'pending') {
      summary.stillPending += 1;
      continue;
    }
    await admin
      .from('signal_outcomes')
      .update({
        status: res.status,
        resolution_price: res.price,
        resolved_at: res.resolvedAtSec ? new Date(res.resolvedAtSec * 1000).toISOString() : null,
        bars_to_resolve: res.barsToResolve,
      })
      .eq('id', row.id);
    if (res.status === 'win') summary.wins += 1;
    else if (res.status === 'loss') summary.losses += 1;
    else summary.expired += 1;
  }
  return summary;
}

/** Aggregate tracked outcomes for the Performance page. Null when unavailable. */
export async function getOutcomeStats(): Promise<OutcomeStats | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('signal_outcomes')
    .select('status, family, entry, stop_loss, take_profit')
    .limit(5000);
  if (error || !data) return null;
  return aggregateOutcomes(
    data.map((r) => ({
      status: r.status,
      family: r.family,
      entry: r.entry,
      stopLoss: r.stop_loss,
      takeProfit: r.take_profit,
    })),
  );
}
