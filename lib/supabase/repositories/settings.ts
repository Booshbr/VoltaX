/**
 * Per-user execution settings (spec §10). Reads/writes the risk_config on the
 * user_settings row (RLS: owner-only). Always returns a safe, clamped RiskSettings —
 * defaults when Supabase or a session is unavailable, so callers never see raw input.
 */
import { createClient, getCurrentUser } from '../server';
import { mergeRiskSettings, DEFAULT_RISK_SETTINGS, type RiskSettings } from '@/lib/config/risk-settings';
import type { Json } from '../database.types';

/** Effective, clamped risk settings for the current user (or defaults). */
export async function getUserRiskSettings(): Promise<RiskSettings> {
  const supabase = await createClient();
  if (!supabase) return DEFAULT_RISK_SETTINGS;
  const user = await getCurrentUser();
  if (!user) return DEFAULT_RISK_SETTINGS;

  const { data } = await supabase.from('user_settings').select('risk_config').eq('user_id', user.id).maybeSingle();
  return mergeRiskSettings((data?.risk_config as Partial<RiskSettings> | null) ?? null);
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  settings?: RiskSettings;
}

/** Persist a partial risk-settings override (merged + clamped). Owner-only via RLS. */
export async function saveUserRiskSettings(partial: Partial<RiskSettings>): Promise<SaveResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Saving settings requires Supabase.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const merged = mergeRiskSettings(partial);
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, risk_config: merged as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  return error ? { ok: false, error: error.message } : { ok: true, settings: merged };
}
