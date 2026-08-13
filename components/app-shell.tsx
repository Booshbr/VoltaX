'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { ThemeToggle } from './theme-toggle';
import { useUnreadCount } from './notifications/store';

type NavItem = { href: string; label: string };

/** Primary navigation, organised as an enterprise workspace. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ href: '/', label: 'Dashboard' }, { href: '/radar', label: 'Market radar' }] },
  {
    label: 'Intelligence',
    items: [
      { href: '/signals', label: 'Signals' },
      { href: '/markets', label: 'Markets' },
      { href: '/charts', label: 'Charts' },
      { href: '/backtesting', label: 'Backtesting' },
    ],
  },
  {
    label: 'Trading desk',
    items: [
      { href: '/paper-trading', label: 'Paper trading' },
      { href: '/live-trading', label: 'Live trading' },
      { href: '/performance', label: 'Performance' },
      { href: '/history', label: 'History' },
      { href: '/alerts', label: 'Alerts' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/data-quality', label: 'Data quality' },
      { href: '/system-health', label: 'System health' },
      { href: '/audit', label: 'Audit log' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

export function AppShell({
  children,
  tradingMode = 'paper',
}: {
  children: React.ReactNode;
  tradingMode?: 'paper' | 'live';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen bg-bg">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[17rem] shrink-0 flex-col border-r border-border bg-surface px-3 py-4 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-2 pb-6 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-fg text-sm font-extrabold tracking-[-0.08em] text-surface" aria-hidden>
            VX
          </span>
          <div>
            <div className="text-base font-extrabold tracking-[-0.05em] text-fg">VoltaX</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Trading intelligence</div>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Workspace</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs font-bold text-fg">
            Synthetic indices
            <span className="h-2 w-2 rounded-full bg-bull" aria-label="System operational" />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} className="mb-5">
              <h2 className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{group.label}</h2>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold transition-colors',
                      isActive(item.href)
                        ? 'bg-fg text-surface shadow-sm'
                        : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    {item.label}
                    {item.href === '/alerts' && <UnreadPip />}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-fg">
            <span className="h-2 w-2 rounded-full bg-bull" aria-hidden />
            Engine operational
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted">Decisions remain deterministic and explainable.</p>
        </div>
      </aside>

      {open ? <div className="fixed inset-0 z-20 bg-fg/20 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[4.5rem] items-center justify-between gap-4 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-fg lg:hidden"
              aria-label="Toggle navigation"
            >
              <MenuIcon />
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Workspace</p>
              <p className="text-sm font-bold text-fg">Deriv synthetic indices</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <ModeIndicator mode={tradingMode} />
            <ThemeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function UnreadPip() {
  const unread = useUnreadCount();
  return unread > 0 ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-surface">{unread > 9 ? '9+' : unread}</span> : null;
}

function NotificationBell() {
  const unread = useUnreadCount();
  return (
    <Link href="/alerts" aria-label={`Alerts${unread > 0 ? ` — ${unread} unread` : ''}`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-fg transition-colors hover:bg-surface-2">
      <BellIcon />
      {unread > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-bear ring-2 ring-surface" /> : null}
    </Link>
  );
}

function ModeIndicator({ mode }: { mode: 'paper' | 'live' }) {
  const live = mode === 'live';
  return (
    <span className={cn('hidden items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] sm:inline-flex', live ? 'border-bear/30 bg-bear/10 text-bear' : 'border-accent/25 bg-accent/10 text-accent')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'animate-pulse bg-bear' : 'bg-accent')} aria-hidden />
      {live ? 'Live mode' : 'Paper mode'}
    </span>
  );
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
