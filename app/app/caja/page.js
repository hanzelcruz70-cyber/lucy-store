import { createClient } from '@/lib/supabase-server';
import CierreCaja from '@/components/CierreCaja';
import ExportButton from './ExportButton';
import CutsHistory from './CutsHistory';

export const dynamic = 'force-dynamic';

const money = (n) =>
  'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

async function getData() {
  const supabase = createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const cutsSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [sales, expenses, cuts, abonosHoy, cutsHistory, profile] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('expenses')
      .select('id, concept, amount, category, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('cash_cuts')
      .select('id, created_at')
      .gte('created_at', start.toISOString())
      .limit(1),
    // Abonos de deudas recibidos hoy (excluye cobros de ventas, que ya están en efectivoSolo)
    supabase
      .from('payments')
      .select('id, amount, method, sale_id')
      .gte('created_at', start.toISOString())
      .limit(100),
    // Historial de cortes (máximo 30 días)
    supabase
      .from('cash_cuts')
      .select('id, sales_total, expenses_total, notes, created_at')
      .gte('created_at', cutsSince.toISOString())
      .order('created_at', { ascending: false })
      .limit(31),
    // Nombre de la tienda para el encabezado del Excel
    supabase
      .from('profiles')
      .select('stores(name)')
      .maybeSingle(),
  ]);

  const todaySales = sales.data || [];
  const todayExpenses = expenses.data || [];
  const cutDone = (cuts.data || []).length > 0;
  const todayPayments = abonosHoy.data || [];

  const total = todaySales.reduce((a, s) => a + Number(s.total), 0);
  const collected = todaySales
    .filter((s) => s.payment_method !== 'fiado')
    .reduce((a, s) => a + Number(s.total), 0);
  const efectivoSolo = todaySales
    .filter((s) => s.payment_method === 'efectivo')
    .reduce((a, s) => a + Number(s.total), 0);
  const transf = todaySales
    .filter((s) => s.payment_method === 'transferencia')
    .reduce((a, s) => a + Number(s.total), 0);
  const credit = todaySales
    .filter((s) => s.payment_method === 'fiado')
    .reduce((a, s) => a + Number(s.total), 0);
  const expTotal = todayExpenses.reduce((a, e) => a + Number(e.amount), 0);
  const pieces = todaySales.reduce((a, s) => a + s.items_count, 0);
  const net = collected - expTotal;
  // Abonos en efectivo recibidos hoy (cobros de deudas, no cobros de ventas)
  const abonosEfectivo = todayPayments
    .filter((p) => !p.sale_id && p.method === 'efectivo')
    .reduce((a, p) => a + Number(p.amount), 0);

  return { todaySales, todayExpenses, cutDone, cutsHistory: cutsHistory.data || [], storeName: profile.data?.stores?.name || 'PacaPOS', total, collected, efectivoSolo, transf, credit, expTotal, pieces, net, abonosEfectivo };
}

export default async function CajaPage() {
  const d = await getData();

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Export (descarga el reporte Excel con formato PacaPOS) */}
      <ExportButton sales={d.todaySales} expenses={d.todayExpenses} storeName={d.storeName} />

      {/* Cierre de caja */}
      <CierreCaja
        contadoEfectivo={d.efectivoSolo}
        contadoTransferencia={d.transf}
        gastos={d.expTotal}
        abonosEfectivo={d.abonosEfectivo}
        fondoInicial={0}
        cutDone={d.cutDone}
      />

      {/* Balance en vivo */}
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5">
        <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none" /> Balance en vivo · hoy
          <span className="ml-auto inline-flex items-center gap-1 bg-primary-fixed text-primary text-[10.5px] font-semibold px-2 py-[3px] rounded-full">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {d.pieces} prendas
          </span>
        </div>
        <span className="text-[12px] text-on-surface-variant block mt-2">Ventas totales hoy</span>
        <div className="text-[26px] font-bold tracking-tight text-on-surface leading-tight">{money(d.total)}</div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-surface-container-low border border-outline rounded-[14px] p-3">
            <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 7" />
              </svg>
              Cobrado
            </div>
            <div className="text-[20px] font-bold text-primary mt-1 leading-tight">{money(d.collected)}</div>
            <div className="text-[12px] text-on-surface-variant mt-0.5">Efectivo + transf.</div>
          </div>
          <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Fiado</span>
              <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-surface-container-lowest border border-primary-fixed-dim text-primary">
                Por cobrar
              </span>
            </div>
            <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">{money(d.credit)}</div>
            <div className="text-[12px] text-on-surface-variant mt-0.5">Ventas a crédito hoy</div>
          </div>
        </div>

        <div className="flex justify-between text-[13px] mt-3">
          <span>
            Margen neto en caja <span className="text-on-surface-variant">(cobrado − gastos)</span>
          </span>
          <b className={d.net >= 0 ? 'text-primary' : 'text-error'}>
            {d.net >= 0 ? '+' : ''}
            {money(d.net)}
          </b>
        </div>
      </div>

      {/* Movimientos del corte */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Movimientos del corte</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">
          {d.todaySales.length + d.todayExpenses.length} registros
        </span>
      </div>
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
        {d.todaySales.length === 0 && d.todayExpenses.length === 0 && (
          <p className="py-6 text-center text-[13px] text-on-surface-variant">Aún no hay movimientos hoy.</p>
        )}
        {d.todaySales.map((s) => (
          <div key={s.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                Venta · {s.client_name || 'Mostrador'}
              </b>
              <span className="block text-[11.5px] text-on-surface-variant truncate">
                {s.notes || s.items_count + ' prendas'} · {s.payment_method === 'fiado' ? 'fiado' : 'contado'}
                {s.channel === 'tiktok_live' ? ' · Live' : ''}
              </span>
            </div>
            <span className="text-[14px] font-bold text-primary whitespace-nowrap">+{money(s.total)}</span>
          </div>
        ))}
        {d.todayExpenses.map((ex) => (
          <div key={ex.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold text-on-surface truncate">Gasto · {ex.concept}</b>
              <span className="block text-[11.5px] text-on-surface-variant capitalize">{ex.category}</span>
            </div>
            <span className="text-[14px] font-bold text-on-surface whitespace-nowrap">−{money(ex.amount)}</span>
          </div>
        ))}
      </div>

      {/* Historial de cortes de caja (filtro máximo 30 días) */}
      <CutsHistory cuts={d.cutsHistory} />
    </div>
  );
}
