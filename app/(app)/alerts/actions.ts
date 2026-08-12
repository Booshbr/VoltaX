'use server';

/** Telegram test-send (spec §29). Server-side; credentials read from env, never
 * exposed. Reports the real delivery result so the user can verify setup. */
export async function sendTestTelegram(): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: 'Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'VOLTAX Test alert\n\nYour Telegram alerts are working.',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Telegram API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed.' };
  }
}
