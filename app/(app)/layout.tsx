import { AppShell } from '@/components/app-shell';

/** Authenticated app shell. Single-user today; the layout is auth-ready — a
 * middleware/session check can gate this group when Supabase is configured.
 * The active data source (live Deriv vs demo) is shown per page via SourceBadge. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell tradingMode="paper">{children}</AppShell>;
}
