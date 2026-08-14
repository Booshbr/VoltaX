/**
 * Web Push subscription endpoint. Requires an authenticated session (the proxy
 * gates it). Stores the browser's PushSubscription so the cloud cron can deliver
 * native alerts, and removes it on unsubscribe.
 */
import { NextResponse } from 'next/server';
import { savePushSubscription, deletePushSubscription, type WebPushSubscription } from '@/lib/supabase/repositories/push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { subscription?: WebPushSubscription };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.subscription?.endpoint) {
    return NextResponse.json({ ok: false, error: 'Missing subscription.' }, { status: 400 });
  }
  const result = await savePushSubscription(body.subscription, request.headers.get('user-agent') ?? undefined);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(request: Request) {
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: 'Missing endpoint.' }, { status: 400 });
  await deletePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
