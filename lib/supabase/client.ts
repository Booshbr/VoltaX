'use client';

/**
 * Browser Supabase client (spec §31). Uses the public anon key; all access is
 * gated by Row Level Security. Returns null when Supabase is not configured so
 * the UI can render a clear "configuration required" state instead of crashing.
 */
import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from './env';

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.anonKey);
}
