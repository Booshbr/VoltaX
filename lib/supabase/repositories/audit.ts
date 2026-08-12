/**
 * Audit log (spec §44). System-written events (auth, signal creation, config /
 * trading changes) recorded via the service-role client so RLS is satisfied, and
 * read back per-user via the session client (RLS select). Never throws — audit
 * logging must not break the action it records.
 */
import { createAdminClient } from '../admin';
import { createClient, getCurrentUser } from '../server';
import type { Database, Json } from '../database.types';

export type AuditRow = Database['public']['Tables']['audit_logs']['Row'];

/** Record an audit event. No-op when Supabase/service role isn't configured. */
export async function writeAudit(
  userId: string | null,
  event: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.from('audit_logs').insert({ user_id: userId, event, detail: detail as unknown as Json });
  } catch {
    // never propagate
  }
}

/** List the current user's audit events, newest first. */
export async function listAudit(limit = 100): Promise<AuditRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditRow[];
}
