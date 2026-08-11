import { PageHeader, ConfigNotice } from '@/components/page';

export const metadata = { title: 'History — VoltaX' };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Signal History" subtitle="Every generated signal, searchable and auditable." />
      <ConfigNotice title="Signal history requires Supabase">
        Signals are persisted immutably with their original conditions, calculations,
        methodology version and final result once Supabase is configured (see
        docs/DATABASE.md). The schema and lifecycle are already implemented; this page
        activates when persistence is connected.
      </ConfigNotice>
    </>
  );
}
