'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { ThemeToggle } from './theme-toggle';

/** Primary navigation (spec §21). */
const NAV: { href: string; label: string; group?: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/radar', label: 'Radar' },
  { href: '/signals', label: 'Signals' },
  { href: '/markets', label: 'Markets' },
  { href: '/backtesting', label: 'Backtesting' },
  { href: '/paper-trading', label: 'Paper Trading' },
  { href: '/live-trading', label: 'Live Trading' },
  { href: '/performance', label: 'Performance' },
  { href: '/history', label: 'History' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/system-health', label: 'System Health' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({
  children,
  tradingMode = 'paper',
  isDemo = true,
}: {
  children: React.ReactNode;
  tradingMode?: 'paper' | 'live';
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-border bg-surface transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="text-lg font-bold tracking-tight text-accent">◈ VoltaX</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                isActive(item.href)
                  ? 'bg-accent/15 font-medium text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Backdrop for mobile */}
      {open ? (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-border p-1.5 text-fg lg:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            {isDemo ? (
              <span className="rounded-md border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">
                Demo data — no live Deriv feed configured
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <ModeIndicator mode={tradingMode} />
            <ThemeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Impossible-to-miss PAPER vs LIVE indicator (spec §56). */
function ModeIndicator({ mode }: { mode: 'paper' | 'live' }) {
  if (mode === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-bear/50 bg-bear/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-bear">
        <span className="h-2 w-2 animate-pulse rounded-full bg-bear" aria-hidden />
        Live mode
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent">
      <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
      Paper mode
    </span>
  );
}
