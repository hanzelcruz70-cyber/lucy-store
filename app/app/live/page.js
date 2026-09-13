import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic } from '@/lib/day';
import LiveConsole from './LiveConsole';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const supabase = createClient();
  // "Hoy" en Nicaragua (UTC-6), no medianoche UTC del servidor
  const start = startOfTodayNic();

  const [{ data: sales }, { data: debts }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .eq('channel', 'tiktok_live')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('debts').select('sale_id').not('sale_id', 'is', null),
  ]);

  // IDs de ventas que ya tienen deuda (evita duplicados al recargar)
  const debtSaleIds = (debts || []).map((d) => d.sale_id);

  return <LiveConsole initialSales={sales || []} initialDebtSaleIds={debtSaleIds} />;
}
