import { createClient } from '@/lib/supabase-server';
import VenderClient from './VenderClient';

export const dynamic = 'force-dynamic';

export default async function VenderPage() {
  const supabase = createClient();

  const [{ data: products }, { data: lots }, { data: clients }] = await Promise.all([
    supabase
      .from('products')
      .select('id, code, name, sale_price, sold_count, lot_id, is_active')
      .eq('is_active', true)
      .order('sold_count', { ascending: false }),
    supabase.from('lots').select('id, code, name, pieces_left').order('created_at', { ascending: 'desc' }),
    supabase.from('clients').select('id, name, balance').order('created_at', { ascending: 'desc' }).limit(200),
  ]);

  return (
    <VenderClient
      products={products || []}
      lots={lots || []}
      clients={clients || []}
    />
  );
}
