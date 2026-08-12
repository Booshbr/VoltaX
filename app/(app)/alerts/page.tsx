import { PageHeader } from '@/components/page';
import { AlertsDesk } from '@/components/notifications/alerts-desk';

export const metadata = { title: 'Alerts — VoltaX' };
export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="In-app, browser and Telegram notifications for qualified signals and system events."
      />
      <AlertsDesk telegramConfigured={telegramConfigured} />
    </>
  );
}
