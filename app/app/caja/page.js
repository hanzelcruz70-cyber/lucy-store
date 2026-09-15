import { createClient } from '@/lib/supabase-server';
import { startOfTodayNic } from '@/lib/day';
import CierreCaja from '@/components/CierreCaja';
import CajaInicial from '@/components/CajaInicial';
import ExportButton from './ExportButton';
import CutsHistory from './CutsHistory';

export const dynamic = 'force-dynamic';

const money = (n) =>
  'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

async function getData() {
  const supabase = createClient();
  // "Hoy" en Nicaragua (UTC-6), no medianoche UTC del servidor
  const start = startOfTodayNic();
  const cutsSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Día de negocio local (YYYY-MM-DD) para el fondo de caja
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const [sales, expenses, cuts, pagosHoy, cutsHistory, profile, opening, debtsHoy] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('expenses')
      .select('id, concept, amount, category, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('cash_cuts')
      .select('id, created_at')
      .gte('created_at', start.toISOString())
      .limit(1),
    // TODOS los pagos de hoy: abonos de deuda (!sale_id) + cobros de
    // apartados de días anteriores (sale_id con payment_method mutado).
    // Los cobros de ventas de HOY ya están dentro de todaySales — no
    // cuentan dos veces (se excluyen comparando contra ventas de hoy).
    supabase
      .from('payments')
      .select('id, amount, method, sale_id, created_at')
      .gte('created_at', start.toISOString())
      .limit(500),
    // Historial de cortes (máximo 30 días)
    supabase
      .from('cash_cuts')
      .select('id, sales_total, expenses_total, abonos_total, transfer_total, fisico_total, discrepancy_amount, notes, created_at')
      .gte('created_at', cutsSince.toISOString())
      .order('created_at', { ascending: false })
      .limit(60),
    // Nombre de la tienda para el encabezado del Excel
    supabase
      .from('profiles')
      .select('stores(name)')
      .maybeSingle(),
    // Fondo de caja con el que se abrió el día
    supabase
      .from('cash_openings')
      .select('amount')
      .eq('day', today)
      .maybeSingle(),
    // Deudas creadas HOY: el "Crédito" del día es deuda REAL contraída
    // (los apartados pendientes de Live son reserva, no crédito)
    supabase
      .from('debts')
      .select('id, client_id, original_amount, sale_id, created_at')
      .gte('created_at', start.toISOString())
      .limit(200),
  ]);

  const todaySales = sales.data || [];
  const todayExpenses = expenses.data || [];
  const cutDone = (cuts.data || []).length > 0;
  const todayPayments = pagosHoy.data || [];
  const todayDebts = debtsHoy.data || [];

  // Ids de ventas registradas HOY: sus pagos (sale_id) ya cuentan dentro
  // de las métricas de todaySales — cobrarlas aquí sería doble conteo.
  const todaySaleIds = new Set(todaySales.map((s) => s.id));

  // Cobros en EFECTIVO de apartados de días ANTERIORES: la clienta pasó HOY
  // por su prenda del Live de ayer — ese billete está en el cajón HOY y
  // debe entrar al esperado del arqueo (antes era invisible: "Sobra" fantasma)
  const cobrosAparEfectivo = todayPayments
    .filter((p) => p.sale_id && !todaySaleIds.has(p.sale_id) && p.method === 'efectivo')
    .reduce((a, p) => a + Number(p.amount), 0);
  const cobrosAparTransf = todayPayments
    .filter((p) => p.sale_id && !todaySaleIds.has(p.sale_id) && p.method === 'transferencia')
    .reduce((a, p) => a + Number(p.amount), 0);

  // Ventas con deuda real (fiadas de verdad): los apartados de Live
  // PENDIENTES (fiado sin deuda) no son ni venta ni crédito todavía (C-4)
  const fiadoSaleIds = new Set((todayDebts || []).map((d) => d.sale_id).filter(Boolean));
  const realSales = todaySales.filter((s) => s.payment_method !== 'fiado' || fiadoSaleIds.has(s.id));
  // Apartados pendientes de hoy (se listan, no se cuentan)
  const pendingApar = todaySales.filter((s) => s.payment_method === 'fiado' && !fiadoSaleIds.has(s.id));
  const pendingTotal = pendingApar.reduce((a, s) => a + Number(s.total), 0);

  const total = realSales.reduce((a, s) => a + Number(s.total), 0);
  const collected = realSales
    .filter((s) => s.payment_method !== 'fiado')
    .reduce((a, s) => a + Number(s.total), 0);
  const efectivoSolo = realSales
    .filter((s) => s.payment_method === 'efectivo')
    .reduce((a, s) => a + Number(s.total), 0);
  const transf = realSales
    .filter((s) => s.payment_method === 'transferencia')
    .reduce((a, s) => a + Number(s.total), 0);
  // Crédito REAL del día: deudas contraídas hoy (mostrador + fiado directo
  // + fiados de Live). Los apartados pendientes NO son crédito todavía.
  const credit = (todayDebts || []).reduce((a, d) => a + Number(d.original_amount), 0);
  const expTotal = todayExpenses.reduce((a, e) => a + Number(e.amount), 0);
  // Prendas movidas hoy = TODAS las ventas (contado + crédito + pendientes):
  // misma cifra que el "CAJA DEL DÍA · N prendas" de Inicio (el pendiente
  // es una prenda apartada; el dinero sí queda fuera del total).
  const pieces = todaySales.reduce((a, s) => a + s.items_count, 0);
  const net = collected - expTotal;
  // Fondo de caja del día (0 si aún no se registra)
  const fondoInicial = Number(opening.data?.amount || 0);
  // Abonos en efectivo recibidos hoy (cobros de deudas, no cobros de ventas)
  const abonosEfectivo = todayPayments
    .filter((p) => !p.sale_id && p.method === 'efectivo')
    .reduce((a, p) => a + Number(p.amount), 0);
  const abonosTodos = todayPayments
    .filter((p) => !p.sale_id)
    .reduce((a, p) => a + Number(p.amount), 0);

  return { todaySales, todayExpenses, todayPayments, todaySaleIds: [...todaySaleIds], cutDone, cutsHistory: cutsHistory.data || [], storeName: profile.data?.stores?.name || 'Mi Prenda', total, collected, efectivoSolo, transf, credit, expTotal, pieces, net, abonosEfectivo, abonosTodos, cobrosAparEfectivo, cobrosAparTransf, fondoInicial, pendingApar, pendingTotal };
}

export default async function CajaPage() {
  const d = await getData();

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Export (descarga el reporte Excel con formato Mi Prenda) */}
      <ExportButton
        sales={d.todaySales}
        expenses={d.todayExpenses}
        payments={d.todayPayments.filter((p) => !d.todaySaleIds.includes(p.sale_id))}
        fondoInicial={d.fondoInicial}
        abonosEfectivo={d.abonosEfectivo}
        cobrosApartadosEfectivo={d.cobrosAparEfectivo}
        cobrosApartadosTransferencia={d.cobrosAparTransf}
        storeName={d.storeName}
        pendingSaleIds={d.pendingApar ? d.pendingApar.map((p) => p.id) : []}
      />

      {/* Caja inicial del día (fondo con el que se abre) */}
      <CajaInicial initial={d.fondoInicial} editable={!d.cutDone} />

      {/* Cierre de caja */}
      <CierreCaja
        contadoEfectivo={d.efectivoSolo}
        contadoTransferencia={d.transf}
        gastos={d.expTotal}
        abonosEfectivo={d.abonosEfectivo}
        cobrosAparadosEfectivo={d.cobrosAparEfectivo}
        cobrosAparadosTransferencia={d.cobrosAparTransf}
        fondoInicial={d.fondoInicial}
        cutDone={d.cutDone}
      />

      {/* Balance en vivo */}
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5">        <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none" /> Balance en vivo · hoy
          <span className="ml-auto inline-flex items-center gap-1 bg-primary-fixed text-primary text-[10.5px] font-semibold px-2 py-[3px] rounded-full">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {d.pieces} prendas
          </span>
        </div>
        <span className="text-[12px] text-on-surface-variant block mt-2">Ventas totales hoy</span>
        <div className="inline-flex items-center leading-none text-[26px] font-bold tracking-tight text-on-surface">{money(d.total)}</div>

        {/* Barra: qué porcentaje de lo vendido ya está cobrado */}
        {d.total > 0 && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] font-semibold text-on-surface-variant mb-1">
              <span>Cobrado</span>
              <span className="text-primary">
                {Math.round((d.collected / d.total) * 100)}% de lo vendido
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((d.collected / d.total) * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-surface-container-low border border-outline rounded-[14px] p-3">
            <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 7" />
              </svg>
              Cobrado hoy
            </div>
            <div className="inline-flex items-center leading-none text-[20px] font-bold text-primary mt-1">{money(d.collected + d.cobrosAparEfectivo + d.cobrosAparTransf)}</div>
            <div className="text-[12px] text-on-surface-variant mt-0.5">Contado + apartados de días anteriores</div>
          </div>
          <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Crédito</span>
              <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-surface-container-lowest border border-primary-fixed-dim text-primary">
                Por cobrar
              </span>
            </div>
            <div className="inline-flex items-center leading-none text-[20px] font-bold text-on-surface mt-1">{money(d.credit)}</div>
            <div className="text-[12px] text-on-surface-variant mt-0.5">Deuda nueva de hoy</div>
          </div>
        </div>

        <div className="flex justify-between text-[13px] mt-3">
          <span>
            Margen neto en caja <span className="text-on-surface-variant">(cobrado − gastos)</span>
          </span>
          <b className={`inline-flex items-center leading-none ${d.net >= 0 ? 'text-primary' : 'text-error'}`}>
            {d.net >= 0 ? '+' : ''}
            {money(d.net)}
          </b>
        </div>
      </div>

      {/* Apartados de Live pendientes de hoy (reserva, no son venta ni crédito) */}
      {d.pendingApar && d.pendingApar.length > 0 && (
        <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[14px] p-3.5">
          <div className="text-[11px] font-semibold text-primary-deep tracking-[0.06em] uppercase flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            Apartados por confirmar · {d.pendingApar.length}
          </div>
          <div className="mt-1.5 flex justify-between items-baseline">
            <span className="text-[12px] text-on-surface-variant">
              Cobrados o fiados, entran al día. Los pendientes de +30 días se limpian solos.
            </span>
            <b className="inline-flex items-center leading-none text-[15px] font-bold text-primary-deep ml-3 whitespace-nowrap">{money(d.pendingTotal)}</b>
          </div>
        </div>
      )}

      {/* Movimientos del corte: ventas + abonos de deuda + cobros de apartados + gastos */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Movimientos del corte</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">
          {d.todaySales.length + d.todayExpenses.length + d.todayPayments.filter((p) => !d.todaySaleIds.includes(p.sale_id)).length} registros
        </span>
      </div>
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
        {d.todaySales.length === 0 && d.todayExpenses.length === 0 && d.todayPayments.filter((p) => !d.todaySaleIds.includes(p.sale_id)).length === 0 && (
          <p className="py-6 text-center text-[13px] text-on-surface-variant">Aún no hay movimientos hoy.</p>
        )}
        {/* Lista con scroll a 5 filas (regla de UI: listas largas no crecen
            la página — se desplazan dentro de la cajita) */}
        <div className="overflow-y-auto scroll-box -mr-1 pr-1" style={{ maxHeight: 5 * 62 }}>
        {d.todaySales.map((s) => {
          const esPendiente = d.pendingApar && d.pendingApar.some((p) => p.id === s.id);
          return (
          <div key={s.id} className={`flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0 ${esPendiente ? 'opacity-70' : ''}`}>
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                {esPendiente ? 'Apartado pendiente · ' : 'Venta · '}{s.client_name || 'Mostrador'}
              </b>
              <span className="block text-[11.5px] text-on-surface-variant truncate">
                {s.notes || s.items_count + ' prendas'} · {esPendiente ? 'pendiente de cobrar o fiar' : s.payment_method === 'fiado' ? 'crédito' : 'contado'}
                {s.channel === 'tiktok_live' ? ' · Live' : ''}
              </span>
            </div>
            <span className={`inline-flex items-center leading-none text-[14px] font-bold whitespace-nowrap ${esPendiente ? 'text-on-surface-variant' : 'text-primary'}`}>
              {esPendiente ? '' : '+'}{money(s.total)}
            </span>
          </div>
          );
        })}
        {d.todayPayments
          .filter((p) => !d.todaySaleIds.includes(p.sale_id))
          .map((p) => (
            <div key={'abono-' + p.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
              <div className="flex-1 min-w-0">
                <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                  {p.sale_id ? 'Apartado cobrado' : 'Abono recibido'}
                </b>
                <span className="block text-[11.5px] text-on-surface-variant">
                  {p.method === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  {p.sale_id ? ' · de un Live anterior' : ''}
                </span>
              </div>
              <span className="inline-flex items-center leading-none text-[14px] font-bold text-primary whitespace-nowrap">+{money(p.amount)}</span>
            </div>
          ))}
        {d.todayExpenses.map((ex) => (
          <div key={ex.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
            <div className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold text-on-surface truncate">Gasto · {ex.concept}</b>
              <span className="block text-[11.5px] text-on-surface-variant capitalize">{ex.category}</span>
            </div>
            <span className="inline-flex items-center leading-none text-[14px] font-bold text-on-surface whitespace-nowrap">−{money(ex.amount)}</span>
          </div>
        ))}
        </div>
      </div>

      {/* Historial de cortes de caja (filtro máximo 30 días) */}
      <CutsHistory cuts={d.cutsHistory} />
    </div>
  );
}
