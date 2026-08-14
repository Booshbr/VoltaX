'use client';

import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status = 'loading' | 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied' | 'busy';

/** Base64url VAPID key → Uint8Array for PushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Enable/disable native push notifications for this device (spec §28, §29). */
export function PushToggle() {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
        setStatus('unsupported');
        return;
      }
      // iOS only supports Web Push inside an installed PWA.
      if (isIos() && !isStandalone()) {
        setStatus('needs-install');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? 'on' : 'off');
      } catch {
        setStatus('off');
      }
    })();
  }, []);

  async function enable() {
    setError(null);
    setStatus('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save subscription.');
      setStatus('on');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
      setStatus('off');
    }
  }

  async function disable() {
    setError(null);
    setStatus('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable notifications.');
      setStatus('on');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-fg">Phone push notifications</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Native alerts on this device the moment a signal qualifies — even with the app closed.
          </p>
        </div>
        {status === 'on' ? (
          <button type="button" onClick={disable} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-2">
            Turn off
          </button>
        ) : status === 'off' ? (
          <button type="button" onClick={enable} className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-surface hover:opacity-90">
            Enable
          </button>
        ) : status === 'busy' || status === 'loading' ? (
          <span className="text-xs font-semibold text-muted">Working…</span>
        ) : null}
      </div>

      {status === 'on' ? <p className="mt-3 text-xs font-semibold text-bull">✓ Enabled on this device.</p> : null}
      {status === 'unsupported' ? (
        <p className="mt-3 text-xs text-muted">This browser doesn’t support push notifications, or push isn’t configured on the server.</p>
      ) : null}
      {status === 'needs-install' ? (
        <p className="mt-3 text-xs text-warn">
          On iPhone/iPad, first add VoltaX to your Home Screen (Share → “Add to Home Screen”), open it from there, then enable push.
        </p>
      ) : null}
      {status === 'denied' ? (
        <p className="mt-3 text-xs text-bear">
          Notifications are blocked for this site. Allow them in your browser’s site settings, then reload.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-bear">{error}</p> : null}
    </div>
  );
}
