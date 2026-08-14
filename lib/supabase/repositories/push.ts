/**
 * Web Push subscription persistence (spec §28, §29). Subscriptions are user-owned
 * (RLS); the scheduled cron reads them via the service role to deliver alerts and
 * prunes any endpoint the push service reports as gone. No-op when unconfigured.
 */
import { createAdminClient } from '../admin';
import { createClient, getCurrentUser } from '../server';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Save (or refresh) the current user's subscription for one device. */
export async function savePushSubscription(sub: WebPushSubscription, userAgent?: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: 'Invalid subscription.' };

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: 'endpoint' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Remove one device's subscription (on disable / unsubscribe). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
}

/** All subscriptions across users — service-role read for the cron sender. */
export async function listAllPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').limit(1000);
  return data ?? [];
}

/** Prune an endpoint the push service reported as gone (404/410). Service role. */
export async function prunePushEndpoint(endpoint: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
