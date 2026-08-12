'use client';

import { useEffect } from 'react';
import { notificationActions } from './store';
import type { QualifiedSignalInput } from '@/lib/notifications/inapp';

/** Mounted on data pages: turns newly-qualified signals into in-app notifications
 * and (if the user granted permission) browser notifications. Renders nothing. */
export function NotificationSync({ signals }: { signals: QualifiedSignalInput[] }) {
  useEffect(() => {
    const added = notificationActions.syncQualified(signals);
    if (added.length === 0) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const n of added) {
        try {
          new Notification(n.title, { body: n.body, tag: n.key });
        } catch {
          // ignore
        }
      }
    }
  }, [signals]);

  return null;
}
