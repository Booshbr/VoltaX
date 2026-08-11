import { AppShell } from '@/components/app-shell';
import { getDerivConfig } from '@/lib/deriv/config';

/** Authenticated app shell. Single-user today; the layout is auth-ready — a
 * middleware/session check can gate this group when Supabase is configured. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Demo mode until a live Deriv account token is configured (spec §81).
  const deriv = getDerivConfig();
  const isDemo = !deriv.hasToken;
  return (
    <AppShell tradingMode="paper" isDemo={isDemo}>
      {children}
    </AppShell>
  );
}
