import { PageHeader, ConfigNotice } from '@/components/page';
import { Card, CardTitle, Dot } from '@/components/ui';

export const metadata = { title: 'Alerts — VoltaX' };

export default function AlertsPage() {
  const telegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return (
    <>
      <PageHeader title="Alerts" subtitle="Browser, Telegram and in-app notifications." />
      <Card className="mb-4">
        <CardTitle>Channels</CardTitle>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between"><span className="text-muted">In-app</span><Dot tone="bull" label="Available" /></li>
          <li className="flex items-center justify-between"><span className="text-muted">Browser</span><Dot tone="warn" label="Requires permission" /></li>
          <li className="flex items-center justify-between"><span className="text-muted">Telegram</span><Dot tone={telegram ? 'bull' : 'muted'} label={telegram ? 'Configured' : 'Not configured'} /></li>
        </ul>
      </Card>
      <ConfigNotice title="Notification delivery">
        The notification provider abstraction (in-app, browser, Telegram) is implemented.
        Telegram delivery activates when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set;
        persisted alert history and preferences activate with Supabase.
      </ConfigNotice>
    </>
  );
}
