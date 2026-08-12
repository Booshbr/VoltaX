'use server';

/**
 * Auth server actions (spec §31, §41). Sign-in/out and password reset via Supabase
 * Auth, server-side. Uses the `(prevState, formData)` signature so the login form
 * can bind them with the form `action` prop — a POST that works even without
 * client JS and NEVER puts credentials in the URL.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AuthResult {
  error?: string;
  message?: string;
}

export async function signIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured on this deployment.' };

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const redirectTo = String(formData.get('redirect') ?? '/') || '/';
  redirect(redirectTo);
}

export async function requestPasswordReset(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured on this deployment.' };

  const email = String(formData.get('email') ?? '');
  if (!email) return { error: 'Enter your email address.' };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl ? `${appUrl}/login` : undefined,
  });
  if (error) return { error: error.message };
  return { message: 'If that email exists, a reset link has been sent.' };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/login');
}
