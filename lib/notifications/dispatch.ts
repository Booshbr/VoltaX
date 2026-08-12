/**
 * Server-side alert dispatch (spec §28, §29, §67). Sends Telegram alerts for
 * NEWLY-qualified signals only, de-duplicated in-memory so each event fires once
 * per server lifetime. Fire-and-forget and fully isolated — a notification
 * failure can never break signal generation or a page render (spec §39).
 */
import { NotificationDispatcher, TelegramNotificationProvider } from './index';
import { buildQualifiedNotification, type QualifiedSignalInput } from './inapp';

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
