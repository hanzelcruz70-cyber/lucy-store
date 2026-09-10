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
  const productList = products || [];
  const lotById = {};
  lotList.forEach((l) => (lotById[l.id] = l));

  // Métricas de stock por producto (solo productos con lote = ingresados con cantidad)
  const pieces = productList.reduce(
    (a, p) => a + (p.lot_id && lotById[p.lot_id] ? lotById[p.lot_id].pieces_left : 0),
    0
  );
  const stockCost = productList.reduce((a, p) => {
    const l = p.lot_id ? lotById[p.lot_id] : null;
    if (!l) return a;
    return a + (l.pieces_left / (l.pieces_total || 1)) * Number(l.total_cost);
  }, 0);
  const invested = productList.reduce((a, p) => {
    const l = p.lot_id ? lotById[p.lot_id] : null;
    if (!l) return a;
    const sold = l.pieces_total - l.pieces_left;
    return a + (sold / (l.pieces_total || 1)) * Number(l.total_cost);
  }, 0);
  const projected = productList.reduce((a, p) => {
    const l = p.lot_id ? lotById[p.lot_id] : null;
    if (!l) return a;
    return a + l.pieces_left * (Number(p.sale_price) - Number(l.total_cost) / (l.pieces_total || 1));
  }, 0);

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Botón principal (mismo lugar del ex-banner de pacas) */}
      <div className="bg-primary rounded-[14px] p-3.5 text-on-primary">
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
          Ingresar producto
        </a>
        <div className="flex justify-between items-center mt-2.5 text-[11.5px] text-primary-fixed">
          <span>Un solo paso: sale directo en Vender</span>
          <span className="bg-white/20 text-on-primary text-[10.5px] font-semibold px-2 py-[3px] rounded-full">Con stock</span>
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

      {/* Productos (con stock) */}
      <ProductsSection initialProducts={productList} lots={lotList} />
    </div>
  );
}
