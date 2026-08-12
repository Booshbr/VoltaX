/**
 * Service-role Supabase client (spec §41, §44). SERVER-SIDE ONLY. Bypasses RLS,
 * for privileged, system-written rows such as audit logs. The service-role key is
 * never exposed to the browser (guarded in env.ts). Returns null when unconfigured.
 */
import { createClient as createSbClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv, getSupabaseServiceKey } from './env';

export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const key = getSupabaseServiceKey();
  if (!env || !key) return null;
  return createSbClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
