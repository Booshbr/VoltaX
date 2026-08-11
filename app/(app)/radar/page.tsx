import { getDemoMarketView } from '@/lib/demo/dataset';
import { PageHeader } from '@/components/page';
import { RadarTable } from '@/components/radar-table';

export const metadata = { title: 'Radar — VoltaX' };

export default function RadarPage() {
  const { evaluations } = getDemoMarketView();
  return (
    <>
      <PageHeader
        title="Market Radar"
        subtitle="Every scanned instrument, continuously ranked by opportunity quality."
      />
      <RadarTable evaluations={evaluations} />
    </>
  );
}
