'use client';

import { useState, useTransition } from 'react';
import { signIn, requestPasswordReset } from '@/app/login/actions';

/** Sign-in form. Submits to the server action; credentials never touch client
 * state beyond the controlled inputs. */
export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resetMode, setResetMode] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = resetMode
        ? await requestPasswordReset(formData)
        : await signIn(formData);
      if (res?.error) setError(res.error);
      if (res?.message) setMessage(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="redirect" value={redirectTo} />
      <label className="block text-sm">
        <span className="text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-fg outline-none focus:border-accent"
        />
      </label>
      {!resetMode ? (
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
      ) : null}

      {error ? <p className="text-sm text-bear">{error}</p> : null}
      {message ? <p className="text-sm text-bull">{message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Please wait…' : resetMode ? 'Send reset link' : 'Sign in'}
      </button>

      <button
        type="button"
        onClick={() => {
          setResetMode((v) => !v);
          setError(null);
          setMessage(null);
        }}
        className="w-full text-center text-xs text-muted hover:text-fg"
      >
        {resetMode ? '← Back to sign in' : 'Forgot your password?'}
      </button>
    </form>
  );
}
