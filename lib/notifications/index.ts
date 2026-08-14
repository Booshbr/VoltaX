/**
 * AppNotification abstraction (spec §28, §29). A provider interface with in-app,
 * browser and Telegram implementations behind it, plus a dispatcher that fans a
 * notification out to all enabled providers. Credentials are read server-side and
 * never hard-coded (spec §29, §41).
 */

export interface AppNotification {
  kind:
    | 'qualified_signal'
    | 'signal_activated'
    | 'tp_reached'
    | 'stop_reached'
    | 'signal_invalidated'
    | 'system_disconnected'
    | 'data_feed_failure'
    | 'trading_error'
    | 'daily_risk_limit';
  title: string;
  body: string;
  /** Optional public https link — rendered as a deep-link button on Telegram. */
  url?: string;
}

/** A Telegram inline button needs a public https URL; localhost/relative links
 * would make Telegram reject the whole message, so we drop them. */
export function telegramButtonUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface NotificationProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(notification: AppNotification): Promise<void>;
}

/** In-app provider — always available; persistence is added when Supabase is on. */
export class InAppNotificationProvider implements NotificationProvider {
  readonly name = 'in-app';
  private readonly sink: (n: AppNotification) => void;
  constructor(sink: (n: AppNotification) => void = () => {}) {
    this.sink = sink;
  }
  isConfigured(): boolean {
    return true;
  }
  async send(n: AppNotification): Promise<void> {
    this.sink(n);
  }
}

/** Browser provider — uses the Web Notifications API when permission is granted. */
export class BrowserNotificationProvider implements NotificationProvider {
  readonly name = 'browser';
  isConfigured(): boolean {
    return typeof Notification !== 'undefined';
  }
  async send(n: AppNotification): Promise<void> {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body });
    }
  }
}

/** Telegram provider — server-side, reads token/chat from env (spec §29). */
export class TelegramNotificationProvider implements NotificationProvider {
  readonly name = 'telegram';
  constructor(
    private readonly token = process.env.TELEGRAM_BOT_TOKEN,
    private readonly chatId = process.env.TELEGRAM_CHAT_ID,
  ) {}
  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }
  async send(n: AppNotification): Promise<void> {
    if (!this.isConfigured()) return;
    const text = `VOLTAX ${n.title}\n\n${n.body}`;
    const payload: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
      disable_web_page_preview: true,
    };
    const buttonUrl = telegramButtonUrl(n.url);
    if (buttonUrl) {
      payload.reply_markup = { inline_keyboard: [[{ text: '📊 Open in VoltaX', url: buttonUrl }]] };
    }
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Never throw into signal generation — notifications degrade independently.
      console.error(`Telegram send failed: ${res.status}`);
    }
  }
}

/**
 * Dispatcher: sends to every configured provider, isolating failures so a broken
 * channel never breaks signal generation (spec §39 degrade safely).
 */
export class NotificationDispatcher {
  constructor(private readonly providers: NotificationProvider[]) {}

  configured(): NotificationProvider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  async dispatch(notification: AppNotification): Promise<void> {
    await Promise.allSettled(
      this.configured().map((p) => p.send(notification)),
    );
  }
}
