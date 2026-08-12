'use client';

import { useEffect, useState, useTransition } from 'react';
import { useNotifications, notificationActions } from './store';
import { sendTestTelegram } from '@/app/(app)/alerts/actions';
import { Card, CardTitle, Badge, Dot } from '@/components/ui';
import { timeAgo } from '@/lib/utils/format';

/** In-app notification center + channel controls (spec §28, §30). */
export function AlertsDesk({ telegramConfigured }: { telegramConfigured: boolean }) {
  const { notifications } = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('unsupported');
  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
  }, []);

  function requestBrowser() {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then((p) => setPerm(p));
  }

  const [pending, startTransition] = useTransition();
  const [tgResult, setTgResult] = useState<string | null>(null);

  function testTelegram() {
    setTgResult(null);
    startTransition(async () => {
      const res = await sendTestTelegram();
      setTgResult(res.ok ? 'Sent — check your Telegram.' : res.error ?? 'Failed.');
    });
  }

  return (
    <div className="space-y-5">
      {/* Channels */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardTitle>In-app</CardTitle>
          <div className="flex items-center justify-between">
            <Dot tone="bull" label="Active" />
            <Badge tone={unread > 0 ? 'accent' : 'muted'}>{unread} unread</Badge>
          </div>
        </Card>

        <Card>
          <CardTitle>Browser</CardTitle>
          {perm === 'unsupported' ? (
            <p className="text-sm text-muted">Not supported in this browser.</p>
          ) : perm === 'granted' ? (
            <Dot tone="bull" label="Enabled" />
          ) : (
            <div className="space-y-2">
              <Dot tone={perm === 'denied' ? 'bear' : 'warn'} label={perm === 'denied' ? 'Blocked' : 'Not enabled'} />
              {perm !== 'denied' ? (
                <button
                  type="button"
                  onClick={requestBrowser}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
                >
                  Enable browser notifications
                </button>
              ) : (
                <p className="text-xs text-muted">Re-enable notifications for this site in your browser settings.</p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Telegram</CardTitle>
          {telegramConfigured ? (
            <div className="space-y-2">
              <Dot tone="bull" label="Configured" />
              <button
                type="button"
                onClick={testTelegram}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send test message'}
              </button>
              {tgResult ? <p className="text-xs text-muted">{tgResult}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Not configured. Set <code className="text-fg">TELEGRAM_BOT_TOKEN</code> and{' '}
              <code className="text-fg">TELEGRAM_CHAT_ID</code> to enable.
            </p>
          )}
        </Card>
      </div>

      {/* Notification history */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle hint={`${notifications.length} total`}>Notifications</CardTitle>
          {notifications.length > 0 ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => notificationActions.markAllRead()} className="text-xs text-muted hover:text-fg">
                Mark all read
              </button>
              <button type="button" onClick={() => notificationActions.clear()} className="text-xs text-muted hover:text-fg">
                Clear
              </button>
            </div>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted">
            No notifications yet. When a signal becomes qualified while you&apos;re using VoltaX, it appears here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => notificationActions.markRead(n.id)}
                className={`flex cursor-pointer items-start gap-3 py-2.5 ${n.read ? 'opacity-60' : ''}`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-muted' : 'bg-accent'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg">{n.title}</div>
                  <div className="text-xs text-muted">{n.body}</div>
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
