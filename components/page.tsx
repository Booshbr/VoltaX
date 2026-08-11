import type { ReactNode } from 'react';
import { Card } from './ui';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** "Feature requires configuration" notice — honest fallback when a real external
 * service isn't wired yet (spec §77, §81). */
export function ConfigNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-warn/40 bg-warn/5">
      <div className="flex items-start gap-3">
        <span className="text-warn" aria-hidden>⚙</span>
        <div>
          <div className="font-medium text-fg">{title}</div>
          <p className="mt-1 text-sm text-muted">{children}</p>
        </div>
      </div>
    </Card>
  );
}

/** Disclaimer shown wherever performance/reliability is presented (spec §2, §64). */
export function Disclaimer() {
  return (
    <p className="mt-4 text-xs text-muted">
      VoltaX presents statistical, historical analysis only. Historical reliability
      and backtested performance do not guarantee future results. Nothing here is
      financial advice.
    </p>
  );
}
