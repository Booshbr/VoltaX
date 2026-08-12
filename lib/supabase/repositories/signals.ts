/**
 * Signal persistence (spec §11, §12, §27). Signals are immutable records; lifecycle
 * changes are appended as events. The pure insert-mappers are unit-tested; the
 * async functions require a configured Supabase and an authenticated user (RLS
 * enforces per-user isolation). Everything degrades to a no-op result when
 * Supabase is not configured (demo mode).
 */
import type { EngineEvaluation } from '@/lib/signals/engine';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { writeAudit } from './audit';
import type { Database, Json } from '@/lib/supabase/database.types';

type SignalInsert = Database['public']['Tables']['signals']['Insert'];
type ReasonInsert = Database['public']['Tables']['signal_reasons']['Insert'];
type EventInsert = Database['public']['Tables']['signal_events']['Insert'];
export type SignalRow = Database['public']['Tables']['signals']['Row'];

/** Pure: map a directional evaluation to a signals-table insert. Caller must
 * ensure `direction` and `risk` are present. */
export function toSignalInsert(e: EngineEvaluation, userId: string): SignalInsert {
  if (!e.direction || !e.risk) {
    throw new Error('Cannot persist a non-directional evaluation');
  }
  const mode = e.qualified ? (e.precision.triggered ? 'precision' : 'entry') : 'setup';
  return {
    user_id: userId,
    instrument_symbol: e.instrumentSymbol,
    instrument_family: e.family,
    direction: e.direction,
    mode,
    status: e.status,
    entry_price: e.risk.entry,
    stop_loss: e.risk.stopLoss,
    take_profits: e.risk.takeProfits as unknown as Json,
    risk_reward: e.riskReward,
    reliability_score: e.reliability.score,
    opportunity_score: e.opportunityScore,
    methodology_version: e.methodologyVersion,
    market_context: { htf: e.htf, mtf: e.mtf } as unknown as Json,
    setup_context: { setup: e.setup } as unknown as Json,
    entry_context: { entry: e.entry, precision: e.precision } as unknown as Json,
    risk_context: {
      entry: e.risk.entry,
      stopLoss: e.risk.stopLoss,
      takeProfits: e.risk.takeProfits,
      riskReward: e.riskReward,
    } as unknown as Json,
  };
}

/** Pure: map an evaluation's structured reasons to signal_reasons inserts. */
export function toReasonInserts(e: EngineEvaluation, signalId: string): ReasonInsert[] {
  return e.reasons.map((r) => ({
    signal_id: signalId,
    category: r.category,
    code: r.code,
    text: r.text,
    polarity: r.polarity,
  }));
}

/** Pure: the initial lifecycle event recording the signal's creation state. */
export function toInitialEventInsert(
  e: EngineEvaluation,
  signalId: string,
): EventInsert {
  return {
    signal_id: signalId,
    from_status: 'scanning',
    to_status: e.status,
    price: e.risk?.entry ?? null,
    note: 'Signal recorded to history',
  };
}

export interface PersistResult {
  id?: string;
  error?: string;
}

/** Persist a directional evaluation as an immutable signal + reasons + event. */
export async function persistSignal(e: EngineEvaluation): Promise<PersistResult> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Persistence requires Supabase configuration.' };
  const user = await getCurrentUser();
  if (!user) return { error: 'You must be signed in to save signals.' };
  if (!e.direction || !e.risk) return { error: 'Only directional setups can be saved.' };

  const { data, error } = await supabase
    .from('signals')
    .insert(toSignalInsert(e, user.id))
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Failed to save signal.' };

  const id = data.id;
  await supabase.from('signal_reasons').insert(toReasonInserts(e, id));
  await supabase.from('signal_events').insert(toInitialEventInsert(e, id));
  await writeAudit(user.id, 'signal_created', {
    signal_id: id,
    symbol: e.instrumentSymbol,
    direction: e.direction,
  });

  return { id };
}

/** List the current user's persisted signals, newest first. */
export async function listSignals(limit = 100): Promise<SignalRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('signals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as SignalRow[];
}
