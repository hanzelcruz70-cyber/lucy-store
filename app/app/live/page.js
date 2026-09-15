import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic, nicDayKey } from '@/lib/day';
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
    // Solo deudas de los últimos 90 días: las ventas de Live viven 30 días
    // (limpieza pg_cron) — deudas viejas no marcan nada útil aquí
    supabase
      .from('debts')
      .select('sale_id')
      .not('sale_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
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

  // Resumen por día de lives anteriores — buckets por DÍA DE NEGOCIO de
  // Nicaragua (nicDayKey), no del servidor UTC: un live de las 8PM cae
  // en su día correcto, no en el siguiente
  const byDay = {};
  (historico || []).forEach((s) => {
    const key = nicDayKey(s.created_at);
    if (!byDay[key]) byDay[key] = { prendas: 0, monto: 0 };
    byDay[key].prendas += s.items_count;
    byDay[key].monto += Number(s.total);
  });
  const todayKey = nicDayKey();
  const historial = Object.entries(byDay)
    .filter(([key]) => key !== todayKey)
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
