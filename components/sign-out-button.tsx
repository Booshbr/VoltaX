'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
