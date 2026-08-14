/**
 * Server-side alert dispatch (spec §28, §29, §67). Sends Telegram alerts for
 * NEWLY-qualified signals only, de-duplicated in-memory so each event fires once
 * per server lifetime. Fire-and-forget and fully isolated — a notification
 * failure can never break signal generation or a page render (spec §39).
 */
import { NotificationDispatcher, TelegramNotificationProvider } from './index';
import { buildQualifiedNotification, type QualifiedSignalInput } from './inapp';
import { createAdminClient } from '@/lib/supabase/admin';

const seenKeys = new Set<string>();

/** Dispatch Telegram alerts for any qualified signals not seen before. */
export async function dispatchQualifiedAlerts(signals: QualifiedSignalInput[]): Promise<void> {
  const telegram = new TelegramNotificationProvider();
  if (!telegram.isConfigured()) return; // nothing to send

  const dispatcher = new NotificationDispatcher([telegram]);
  for (const s of signals) {
    const { key, notification } = buildQualifiedNotification(s);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    try {
      await dispatcher.dispatch(notification);
    } catch {
      // Never propagate a notification failure.
    }
  }
}

export interface AlertDispatchResult {
  configured: boolean;
  sent: number;
  skipped: number;
}

/** How long a given signal key stays de-duplicated across cron runs. */
const DEDUP_WINDOW_MS = 60 * 60_000;
const ALERT_EVENT = 'telegram_alert';

/**
 * Cloud-safe alert dispatch for the scheduled cron. Unlike {@link dispatchQualifiedAlerts},
 * this does NOT rely on a browser being open or on per-instance memory: de-duplication
 * is persisted in `audit_logs` via the service-role client, so a signal alerts once
 * per {@link DEDUP_WINDOW_MS} regardless of which serverless instance handles the run.
 * Fail-safe: any error is swallowed so a notification issue never breaks the cron.
 */
export async function dispatchQualifiedAlertsPersistent(signals: QualifiedSignalInput[]): Promise<AlertDispatchResult> {
  const telegram = new TelegramNotificationProvider();
  if (!telegram.isConfigured()) return { configured: false, sent: 0, skipped: 0 };

  const admin = createAdminClient();
  const dispatcher = new NotificationDispatcher([telegram]);
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  let sent = 0;
  let skipped = 0;

  for (const s of signals) {
    const { key, notification } = buildQualifiedNotification(s);

    if (admin) {
      const { data: existing } = await admin
        .from('audit_logs')
        .select('id')
        .eq('event', ALERT_EVENT)
        .contains('detail', { key })
        .gte('created_at', cutoff)
        .limit(1);
      if (existing?.length) {
        skipped += 1;
        continue;
      }
    }

    try {
      await dispatcher.dispatch(notification);
      sent += 1;
      if (admin) {
        await admin.from('audit_logs').insert({
          user_id: null,
          event: ALERT_EVENT,
          detail: { key, symbol: s.symbol, direction: s.direction },
        });
      }
    } catch {
      // Never propagate a notification failure.
    }
  }

  return { configured: true, sent, skipped };
}
