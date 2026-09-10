import { createClient } from '@/lib/supabase-server';
import ProductsSection from './ProductsSection';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const supabase = createClient();

  const [{ data: lots }, { data: products }] = await Promise.all([
    supabase
      .from('lots')
      .select('id, code, name, pieces_total, pieces_left, total_cost, avg_sale_price, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, code, name, sale_price, sold_count, lot_id, is_active')
      .eq('is_active', true)
      .order('sold_count', { ascending: false }),
  ]);

  const lotList = lots || [];
  const pieces = lotList.reduce((a, l) => a + l.pieces_left, 0);
  // Costo de la mercancía vendida (porción del costo de cada paca proporcional a lo vendido)
  const invested = lotList.reduce((a, l) => {
    const sold = l.pieces_total - l.pieces_left;
    return a + (sold / (l.pieces_total || 1)) * Number(l.total_cost);
  }, 0);
  // Costo de la mercancía que queda en stock (inversión pendiente de recuperar)
  const stockCost = lotList.reduce((a, l) => {
    return a + (l.pieces_left / (l.pieces_total || 1)) * Number(l.total_cost);
  }, 0);
  const projected = lotList.reduce(
    (a, l) => a + l.pieces_left * (Number(l.avg_sale_price) - Number(l.total_cost) / (l.pieces_total || 1)),
    0
  );

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Banner paca (rosa sólido, estilo mockup) */}
      <div className="bg-primary border border-primary rounded-[14px] p-3.5 text-on-primary">
        <div className="flex justify-between items-center text-[11px] font-semibold uppercase tracking-[0.06em] text-primary-fixed">
          <span className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
            </svg>
            Ingreso express sin tallas
          </span>
          <span>Modo ágil</span>
        </div>
        <a
          href="/app/inventario/nuevo"
          prefetch
          className="w-full py-3 mt-3 rounded-xl bg-surface-container-lowest text-primary-deep text-[13.5px] font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 3v18M3 12h18" />
          </svg>
          Entró nueva paca / lote
        </a>
        <div className="flex justify-between items-center mt-2.5 text-[11.5px] text-primary-fixed">
          <span>Sin tallas, sin complicación</span>
          <span className="bg-white/20 text-on-primary text-[10.5px] font-semibold px-2 py-[3px] rounded-full">Margen 2.5x</span>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Resumen financiero stock</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">Ropa americana</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Prendas</div>
          <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">{pieces}</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">En stock cuesta</div>
          <div className="text-[20px] font-bold text-primary mt-1 leading-tight">
            C${stockCost.toLocaleString('es-NI', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">si vendieras todo, recuperas esto</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Costo de lo vendido</div>
          <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">
            C${invested.toLocaleString('es-NI', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Ganancia est.</div>
          <div className="text-[15px] font-bold text-primary mt-1.5 leading-tight">
            +C${projected.toLocaleString('es-NI', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Pacas */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Pacas activas en tienda</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">
          {lotList.length} lotes
        </span>
      </div>

      {lotList.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">Sin lotes aún. Registra tu primera paca arriba.</p>
        </div>
      )}

      {lotList.map((l) => {
        const soldPct = l.pieces_total > 0 ? Math.round(((l.pieces_total - l.pieces_left) / l.pieces_total) * 100) : 0;
        const unitCost = l.pieces_total > 0 ? Number(l.total_cost) / l.pieces_total : 0;
        const profitPer = Number(l.avg_sale_price) - unitCost;
        const low = soldPct < 20 && Date.now() - new Date(l.created_at).getTime() > 7 * 24 * 3600 * 1000;
        return (
          <div key={l.id} className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-[38px] h-[38px] rounded-[10px] flex-none bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12l-1.5 18h-9zM8 8c2.5 1.5 5.5 1.5 8 0" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className={`inline-block text-[9.5px] font-bold px-2 py-[2px] rounded-full uppercase ${low ? 'bg-primary text-on-primary' : 'bg-primary-fixed text-primary'}`}>
                  {l.code}
                </span>
                <b className="block text-[14.5px] text-on-surface mt-0.5 truncate">{l.name}</b>
              </div>
              <b className={`text-[12.5px] ${low ? 'text-error' : 'text-primary'}`}>{soldPct}% vendido</b>
            </div>
            <div className="flex justify-between text-[12px] mt-2.5">
              <span className="text-on-surface-variant">
                Quedan <b className="text-on-surface">{l.pieces_left}</b> de {l.pieces_total}
              </span>
              <span className="text-on-surface-variant">
                costo C${unitCost.toFixed(0)} · venta C${Number(l.avg_sale_price).toFixed(0)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-2">
              <div
                className={`h-full rounded-full ${low ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${soldPct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 mt-3 border-t border-surface-container pt-2.5">
              <div className="text-center">
                <small className="block text-[10px] text-on-surface-variant mb-0.5">Costo p/prenda</small>
                <b className="text-[12.5px] text-on-surface">C${unitCost.toFixed(0)} c/u</b>
              </div>
              <div className="text-center border-l border-surface-container">
                <small className="block text-[10px] text-on-surface-variant mb-0.5">Venta prom.</small>
                <b className="text-[12.5px] text-primary">C${Number(l.avg_sale_price).toFixed(0)} c/u</b>
              </div>
              <div className="text-center border-l border-surface-container">
                <small className="block text-[10px] text-on-surface-variant mb-0.5">Ganancia p/pza</small>
                <b className="text-[12.5px] text-primary">+C${profitPer.toFixed(0)}</b>
              </div>
            </div>
          </div>
        );
      })}

      {/* Productos */}
      <ProductsSection initialProducts={products || []} lots={lotList} />
    </div>
  );
}
