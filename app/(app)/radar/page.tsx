import { getMarketView } from '@/lib/market/source';
import { PageHeader, SourceBadge } from '@/components/page';
import { RadarTable } from '@/components/radar-table';

export const metadata = { title: 'Radar — VoltaX' };
export const dynamic = 'force-dynamic';

export default async function RadarPage() {
  const { evaluations, source } = await getMarketView();
  return (
    <>
      <PageHeader
        title="Market Radar"
        subtitle="Every scanned instrument, continuously ranked by opportunity quality."
        actions={<SourceBadge source={source} />}
      />
      <RadarTable evaluations={evaluations} />
    </>
  );
}
