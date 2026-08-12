import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle, Badge } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { listAudit } from '@/lib/supabase/repositories/audit';
import { titleCase } from '@/lib/utils/format';

export const metadata = { title: 'Audit Log — VoltaX' };
export const dynamic = 'force-dynamic';

const EVENT_TONE: Record<string, 'bull' | 'bear' | 'warn' | 'accent' | 'muted'> = {
  auth_login: 'accent',
  signal_created: 'bull',
  live_enabled: 'warn',
  live_disabled: 'muted',
  emergency_stop: 'bear',
};

export default async function AuditPage() {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader title="Audit Log" subtitle="A durable record of important account and system events." />
        <ConfigNotice title="Audit log requires Supabase">
          Authentication, signal-creation, configuration and trading events are recorded
          immutably once Supabase is configured (spec §44). The write path (service-role,
          RLS-safe) is implemented; this page lists your events as soon as it&apos;s connected.
        </ConfigNotice>
      </>
    );
  }

  const rows = await listAudit(200);

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Important account and system events, newest first." />
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No events yet. Signing in and saving signals are recorded here.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle hint={`${rows.length} events`}>Events</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="px-3 py-2">
                      <Badge tone={EVENT_TONE[r.event] ?? 'muted'}>{titleCase(r.event)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      <code className="break-all">{JSON.stringify(r.detail)}</code>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
