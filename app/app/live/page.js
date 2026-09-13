import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic } from '@/lib/day';
import LiveConsole from './LiveConsole';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const supabase = createClient();
  // "Hoy" en Nicaragua (UTC-6), no medianoche UTC del servidor
  const start = startOfTodayNic();
  const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // últimos 31 días (filtro máx 30)

  const [{ data: sales }, { data: debts }, { data: historico }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .eq('channel', 'tiktok_live')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('debts').select('sale_id').not('sale_id', 'is', null),
    // Historial de lives de días anteriores (para el resumen por día)
    supabase
      .from('sales')
      .select('id, total, items_count, created_at')
      .eq('channel', 'tiktok_live')
      .gte('created_at', since.toISOString())
      .lt('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // IDs de ventas que ya tienen deuda (evita duplicados al recargar)
  const debtSaleIds = (debts || []).map((d) => d.sale_id);

  // Resumen por día de lives anteriores
  const byDay = {};
  (historico || []).forEach((s) => {
    const day = new Date(s.created_at);
    const key = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { prendas: 0, monto: 0 };
    byDay[key].prendas += s.items_count;
    byDay[key].monto += Number(s.total);
  });
  const historial = Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30)
    .map(([fecha, v]) => ({ fecha, prendas: v.prendas, monto: v.monto }));

  return (
    <LiveConsole
      initialSales={sales || []}
      initialDebtSaleIds={debtSaleIds}
      historial={historial}
    />
  );
}
