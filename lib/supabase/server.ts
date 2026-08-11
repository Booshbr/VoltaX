/**
 * Server Supabase client (spec §31). Wires Supabase Auth to Next.js cookies so
 * sessions persist and RLS applies to the authenticated user. Returns null when
 * Supabase is not configured. Never trust client-side authorization — always
 * check on the server (spec §31 "Never trust client-side authorization").
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicEnv } from './env';

export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` may be called from a Server Component where cookies are
          // read-only; safe to ignore when middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Get the current authenticated user on the server, or null. Central helper so
 * every protected route enforces auth the same way.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
