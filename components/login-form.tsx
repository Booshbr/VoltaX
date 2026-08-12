'use client';

import { useActionState, useState } from 'react';
import { signIn, requestPasswordReset, type AuthResult } from '@/app/login/actions';

/**
 * Sign-in form. Binds the server action via the form `action` prop, so submission
 * is always a POST to the server action — it works even before/without client JS,
 * and credentials are NEVER placed in the URL.
 */
export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [resetMode, setResetMode] = useState(false);
  const [signInState, signInAction, signInPending] = useActionState<AuthResult | null, FormData>(
    signIn,
    null,
  );
  const [resetState, resetAction, resetPending] = useActionState<AuthResult | null, FormData>(
    requestPasswordReset,
    null,
  );

  const state = resetMode ? resetState : signInState;
  const pending = resetMode ? resetPending : signInPending;

  return (
    <form action={resetMode ? resetAction : signInAction} className="space-y-3">
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

      {state?.error ? <p className="text-sm text-bear">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-bull">{state.message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Please wait…' : resetMode ? 'Send reset link' : 'Sign in'}
      </button>

      <button
        type="button"
        onClick={() => setResetMode((v) => !v)}
        className="w-full text-center text-xs text-muted hover:text-fg"
      >
        {resetMode ? '← Back to sign in' : 'Forgot your password?'}
      </button>
    </form>
  );
}
