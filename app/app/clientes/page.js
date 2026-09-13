import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic } from '@/lib/day';
import ClientsList from './ClientsList';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const supabase = createClient();
  // "Hoy" en Nicaragua (UTC-6), no medianoche UTC del servidor
  const start = startOfTodayNic();

  const [{ data: clients }, { data: debts }, { data: payments }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, phone, tiktok, is_live_client, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('debts')
      .select('id, client_id, remaining, original_amount, description, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, debt_id, amount, method, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const clientList = clients || [];
  const debtList = debts || [];
  const payList = payments || [];

  const movsByClient = {};
  debtList.forEach((d) => {
    if (!movsByClient[d.client_id]) movsByClient[d.client_id] = [];
    movsByClient[d.client_id].push({
      id: 'd-' + d.id,
      type: 'FIADO',
      amount: Number(d.original_amount),
      description: d.description,
      date: d.created_at,
    });
  });
  payList.forEach((p) => {
    if (p.debt_id) {
      const debt = debtList.find((d) => d.id === p.debt_id);
      if (debt) {
        if (!movsByClient[debt.client_id]) movsByClient[debt.client_id] = [];
        movsByClient[debt.client_id].push({
          id: 'p-' + p.id,
          type: 'ABONO',
          amount: Number(p.amount),
          description: null,
          date: p.created_at,
        });
      }
    }
  });

  // ===== Saldo total de la calle (histórico, no cambia con el día) =====
  const debtByClient = {};
  debtList
    .filter((d) => d.status === 'pendiente')
    .forEach((d) => {
      debtByClient[d.client_id] = (debtByClient[d.client_id] || 0) + Number(d.remaining);
    });

  // ===== Métricas de HOY (se reinician cada día) =====
  const startISO = start.toISOString();
  const fiadoHoy = debtList
    .filter((d) => d.created_at >= startISO)
    .reduce((a, d) => a + Number(d.original_amount), 0);
  const recuperadoHoy = payList
    .filter((p) => p.debt_id && p.created_at >= startISO)
    .reduce((a, p) => a + Number(p.amount), 0);

  // ===== Historial por día (hasta 30 días, sin hoy — filtrable en la UI) =====
  const byDay = {};
  debtList.forEach((d) => {
    if (d.status !== 'pendiente' && Number(d.remaining) === Number(d.original_amount)) return;
    const day = new Date(d.created_at);
    const key = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { fiado: 0, recuperado: 0 };
    byDay[key].fiado += Number(d.original_amount);
  });
  payList.forEach((p) => {
    if (!p.debt_id) return;
    const day = new Date(p.created_at);
    const key = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { fiado: 0, recuperado: 0 };
    byDay[key].recuperado += Number(p.amount);
  });
  const todayKey = new Date().toISOString().slice(0, 10);
  const historial = Object.entries(byDay)
    .filter(([key]) => key !== todayKey)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30)
    .map(([fecha, v]) => ({ fecha, fiado: v.fiado, recuperado: v.recuperado }));

  const withDebt = clientList.filter((c) => debtByClient[c.id] > 0);
  const current = clientList.filter((c) => !debtByClient[c.id]);

  return (
    <ClientsList
      withDebt={withDebt}
      current={current}
      debtByClient={debtByClient}
      totalDebt={Object.values(debtByClient).reduce((a, b) => a + b, 0)}
      fiadoHoy={fiadoHoy}
      recuperadoHoy={recuperadoHoy}
      historial={historial}
      movsByClient={movsByClient}
    />
  );
}
