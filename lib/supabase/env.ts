/**
 * Supabase environment access (spec §10, §48). The URL and anon key are safe to
 * expose to the browser (NEXT_PUBLIC_*, protected by RLS). The service-role key is
 * server-only and never imported into client bundles.
 */
export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

/** Server-only: the service-role key. Never expose to the client (spec §41). */
export function getSupabaseServiceKey(): string | null {
  if (typeof window !== 'undefined') return null;
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}
