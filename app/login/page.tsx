import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { LoginForm } from '@/components/login-form';
import { Card } from '@/components/ui';

export const metadata = { title: 'Sign in — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const configured = isSupabaseConfigured();
  // If already signed in, go straight to the app.
  if (configured) {
    const user = await getCurrentUser();
    if (user) redirect(redirectTo || '/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-accent">◈ VoltaX</div>
          <p className="mt-1 text-sm text-muted">Trading intelligence for Deriv synthetic indices</p>
        </div>

        <Card>
          {configured ? (
            <>
              <h1 className="mb-4 text-lg font-semibold text-fg">Sign in</h1>
              <LoginForm redirectTo={redirectTo || '/'} />
            </>
          ) : (
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-fg">Authentication not configured</h1>
              <p className="text-sm text-muted">
                Supabase is not configured, so VoltaX is running in open demo mode — no
                sign-in is required. Configure <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
                and the anon key (see docs/SETUP.md) to enable authentication.
              </p>
              <Link href="/" className="inline-block pt-2 text-sm font-medium text-accent hover:underline">
                Continue to VoltaX →
              </Link>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          Single-user deployment. Historical performance is not a guarantee of future results.
        </p>
      </div>
    </main>
  );
}
