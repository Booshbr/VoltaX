import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Reusable presentational primitives shared across VoltaX pages. */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-4 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-fg">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'bull' | 'bear' | 'warn' | 'accent';
}) {
  const toneClass = {
    default: 'text-fg',
    bull: 'text-bull',
    bear: 'text-bear',
    warn: 'text-warn',
    accent: 'text-accent',
  }[tone];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('tnum text-2xl font-semibold', toneClass)}>{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

type BadgeTone = 'default' | 'bull' | 'bear' | 'neutral' | 'warn' | 'accent' | 'muted';

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    default: 'bg-surface-2 text-fg border-border',
    bull: 'bg-bull/15 text-bull border-bull/30',
    bear: 'bg-bear/15 text-bear border-bear/30',
    neutral: 'bg-muted/15 text-muted border-muted/30',
    warn: 'bg-warn/15 text-warn border-warn/30',
    accent: 'bg-accent/15 text-accent border-accent/30',
    muted: 'bg-surface-2 text-muted border-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status dot with an accessible label — never colour alone (spec §51). */
export function Dot({
  tone,
  label,
}: {
  tone: 'bull' | 'bear' | 'warn' | 'muted' | 'accent';
  label?: string;
}) {
  const colors = {
    bull: 'bg-bull',
    bear: 'bg-bear',
    warn: 'bg-warn',
    muted: 'bg-muted',
    accent: 'bg-accent',
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', colors)} aria-hidden />
      {label ? <span className="text-xs text-muted">{label}</span> : null}
    </span>
  );
}

/** Horizontal quality/score bar (0..100). */
export function ScoreBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'bull' | 'bear' | 'warn' }) {
  const color = { accent: 'bg-accent', bull: 'bg-bull', bear: 'bg-bear', warn: 'bg-warn' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Beginner-friendly info tooltip (spec §32, §52). */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex cursor-help items-center border-b border-dotted border-muted text-inherit">
      {term}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface-2 p-2 text-xs font-normal text-fg opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
