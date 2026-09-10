import { createClient } from '@/lib/supabase-server';
import ClientsList from './ClientsList';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const supabase = createClient();

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

  const debtByClient = {};
  let totalDebt = 0;
  let recovered = 0;
  debtList
    .filter((d) => d.status === 'pendiente')
    .forEach((d) => {
      debtByClient[d.client_id] = (debtByClient[d.client_id] || 0) + Number(d.remaining);
      totalDebt += Number(d.remaining);
    });
  debtList.forEach((d) => {
    recovered += Number(d.original_amount) - Number(d.remaining);
  });

  const withDebt = clientList.filter((c) => debtByClient[c.id] > 0);
  const current = clientList.filter((c) => !debtByClient[c.id]);

  return (
    <ClientsList
      withDebt={withDebt}
      current={current}
      debtByClient={debtByClient}
      totalDebt={totalDebt}
      recovered={recovered}
      movsByClient={movsByClient}
    />
  );
}
