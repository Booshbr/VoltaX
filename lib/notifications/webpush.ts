/**
 * Web Push provider (spec §28, §29). SERVER-SIDE ONLY. Delivers a notification to
 * every stored subscription using VAPID auth. Endpoints the push service reports as
 * gone (404/410) are pruned. Fully isolated: failures never break signal generation.
 *
 * Required env (server): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * (a mailto: or https: contact). The public key is also exposed to the client as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY for the subscribe call.
 */
import webpush from 'web-push';
import type { AppNotification, NotificationProvider } from './index';
import { listAllPushSubscriptions, prunePushEndpoint } from '@/lib/supabase/repositories/push';

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:alerts@voltax.app';
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function isWebPushConfigured(): boolean {
  return ensureConfigured();
}

export class WebPushNotificationProvider implements NotificationProvider {
  readonly name = 'web-push';

  isConfigured(): boolean {
    return ensureConfigured();
  }

  async send(n: AppNotification): Promise<void> {
    if (!ensureConfigured()) return;
    const subscriptions = await listAllPushSubscriptions();
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: `VoltaX — ${n.title}`,
      body: n.body,
      url: n.url ?? '/',
      tag: n.kind,
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await prunePushEndpoint(sub.endpoint);
        }
      }),
    );
  }
}
