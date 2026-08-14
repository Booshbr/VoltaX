import { PageHeader } from '@/components/page';
import { AlertsDesk } from '@/components/notifications/alerts-desk';
import { PushToggle } from '@/components/notifications/push-toggle';

export const metadata = { title: 'Alerts — VoltaX' };
export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="In-app, browser, phone push and Telegram notifications for qualified signals and system events."
      />
      <div className="mb-5">
        <PushToggle />
      </div>
      <AlertsDesk telegramConfigured={telegramConfigured} />
    </>
  );
}
