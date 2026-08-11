'use client';

import { useState, useTransition } from 'react';
import { saveSignalToHistory } from '@/app/(app)/signals/[symbol]/actions';

/** Persist the current signal to history (spec §27). Shown only when Supabase is
 * configured; the server action enforces auth + RLS. */
export function SaveSignalButton({ symbol }: { symbol: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  function onClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveSignalToHistory(symbol);
      if (res.error) {
        setState('error');
        setMessage(res.error);
      } else {
        setState('saved');
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || state === 'saved'}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
      >
        {pending ? 'Saving…' : state === 'saved' ? 'Saved to history ✓' : 'Save to history'}
      </button>
      {message ? <span className="text-xs text-bear">{message}</span> : null}
    </span>
  );
}
