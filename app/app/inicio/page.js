import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic } from '@/lib/day';
import InicioClient from './InicioClient';

export const dynamic = 'force-dynamic';

export default async function InicioPage() {
  const supabase = createClient();
  // "Hoy" en Nicaragua (UTC-6), no medianoche UTC del servidor
  const start = startOfTodayNic();

  const [sales, expenses, payments, debts, clients, allPayments] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('expenses')
      .select('id, concept, amount, category, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('payments')
      .select('id, sale_id, debt_id, amount, method, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('debts')
      .select('id, client_id, original_amount, description, remaining, status, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('clients')
      .select('id, name, phone, is_live_client')
      .order('created_at', { ascending: false })
      .limit(200),
    // Historial de abonos (para el modal del deudor) — en paralelo, no secuencial
    supabase
      .from('payments')
      .select('id, debt_id, sale_id, amount, method, created_at')
      .order('created_at', { ascending: false })
      .limit(150),
  ]);

  const saleList = sales.data || [];
  const expList = expenses.data || [];
  // Solo abonos reales de deudas: los pagos ligados a una venta (sale_id) ya se
  // muestran como la venta misma; no deben duplicarse como "Abono recibido".
  const payList = (payments.data || []).filter((p) => !p.sale_id);
  const debtList = debts.data || [];
  const clientList = clients.data || [];

  const debtByClient = {};
  debtList.forEach((d) => {
    if (d.status !== 'pendiente') return;
    debtByClient[d.client_id] = (debtByClient[d.client_id] || 0) + Number(d.remaining);
  });
  const debtors = clientList
    .filter((c) => debtByClient[c.id] > 0)
    .map((c) => ({ ...c, balance: debtByClient[c.id] }));

  // Nombre del cliente por deuda (para mostrar "Abono recibido · <nombre>" en movimientos)
  const clientById = {};
  clientList.forEach((c) => (clientById[c.id] = c.name));
  const debtById = {};
  debtList.forEach((d) => (debtById[d.id] = d.client_id));
  const debtorNameByPayment = {};
  // Historial FIADO/ABONO por cliente (para el modal de abono)
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
  (allPayments.data || []).forEach((p) => {
    if (p.sale_id) return; // cobros de ventas, no abonos de deuda
    const cid = p.debt_id ? debtById[p.debt_id] : null;
    if (!cid) return;
    if (!movsByClient[cid]) movsByClient[cid] = [];
    movsByClient[cid].push({
      id: 'p-' + p.id,
      type: 'ABONO',
      amount: Number(p.amount),
      description: null,
      date: p.created_at,
    });
    if (!debtorNameByPayment[p.id]) {
      debtorNameByPayment[p.id] = clientById[cid] || '';
    }
  });

  const contado = saleList
    .filter((s) => s.payment_method !== 'fiado')
    .reduce((a, s) => a + Number(s.total), 0);
  const fiado = saleList.filter((s) => s.payment_method === 'fiado').reduce((a, s) => a + Number(s.total), 0);
  const abonos = payList.reduce((a, p) => a + Number(p.amount), 0);
  const gastos = expList.reduce((a, e) => a + Number(e.amount), 0);
  const piezas = saleList.reduce((a, s) => a + s.items_count, 0);

  // Folios únicos del día: #001, #002... por orden cronológico
  const allMovs = [
    ...saleList.map((s) => ({ ...s, _tipo: 'venta' })),
    ...payList.map((p) => ({ ...p, _tipo: 'abono' })),
    ...expList.map((e) => ({ ...e, _tipo: 'gasto' })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const folioByMov = {};
  allMovs.forEach((m, i) => {
    folioByMov[m.id] = '#' + String(i + 1).padStart(3, '0');
  });

  return (
    <InicioClient
      contado={contado}
      fiado={fiado}
      abonos={abonos}
      gastos={gastos}
      piezas={piezas}
      sales={saleList}
      expenses={expList}
      payments={payList}
      debtors={debtors}
      folioByMov={folioByMov}
      debtorNameByPayment={debtorNameByPayment}
      movsByClient={movsByClient}
    />
  );
}
