import { createClient } from '@/lib/supabase-server';
import MasClient from './MasClient';

export const dynamic = 'force-dynamic';

export default async function MasPage() {
  const supabase = createClient();

  const [expenses, sales] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, concept, amount, category, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  return (
    <MasClient
      expenses={expenses.data || []}
      sales={sales.data || []}
    />
  );
}
