import { createClient } from '@/lib/supabase-server';
import Link from 'next/link';
import ProductsSection from './ProductsSection';
import OrphanLotActions from './OrphanLotActions';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const supabase = createClient();

  const [{ data: lots }, { data: products }] = await Promise.all([
    supabase
      .from('lots')
      .select('id, code, name, pieces_total, pieces_left, total_cost, avg_sale_price, store_id, created_at')
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

  // Inversión REAL: todos los lotes de la tienda (aunque el producto ligado falte)
  const totalInvested = lotList.reduce((a, l) => a + Number(l.total_cost), 0);
  // Lotes huérfanos: existe el lote pero ningún producto lo referencia (Paca #1 vieja)
  const orphanLots = lotList.filter(
    (l) => !productList.some((p) => p.lot_id === l.id) && l.pieces_left > 0
  );
  const orphanStock = orphanLots.reduce((a, l) => a + l.pieces_left, 0);

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
        <Link
          href="/app/inventario/nuevo"
          prefetch
          className="w-full py-3 mt-3 rounded-xl bg-surface-container-lowest text-primary-deep text-[13.5px] font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 3v18M3 12h18" />
          </svg>
          Ingresar producto
        </Link>
        <div className="flex justify-between items-center mt-2.5 text-[11.5px] text-primary-fixed">
          <span>Un solo paso: sale directo en Vender</span>
          <span className="bg-white/20 text-on-primary text-[10.5px] font-semibold px-2 py-[3px] rounded-full">Con stock</span>
        </div>
      </div>

      {/* Lote huérfano: existe pero sin producto ligado — resolver para que el stock cuadre */}
      {orphanLots.length > 0 && (
        <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[14px] p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B92B6C" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
              <path d="M12 8v5M12 16.5h.01" />
              <path d="M10.3 3.8L1.8 18.4a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
            </svg>
            <div className="text-[12px] text-primary-deep leading-relaxed">
              <b>{orphanLots.length} lote{orphanLots.length > 1 ? 's' : ''} sin producto</b> ({orphanStock} prendas) — ingresaste stock que no aparece en Vender.
              Lígalo a un producto o elimínalo para que el resumen cuadre.
            </div>
          </div>
          {orphanLots.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2">
              <div className="min-w-0">
                <b className="block text-[12.5px] font-semibold text-on-surface truncate">
                  <span className="inline-block bg-primary-fixed text-primary text-[10px] font-bold px-1.5 py-[2px] rounded-md mr-1.5">{l.code}</span>
                  {l.name}
                </b>
                <span className="block text-[11px] text-on-surface-variant">
                  Quedan {l.pieces_left} de {l.pieces_total} · C${Number(l.total_cost).toLocaleString('es-NI', { maximumFractionDigits: 0 })} invertidos
                </span>
              </div>
              <OrphanLotActions lot={l} />
            </div>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Resumen financiero stock</b>
        <span className="inline-flex text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-primary-fixed text-primary">Ropa americana</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Prendas</div>
          <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">{pieces + orphanStock}</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3 text-center">
          <div className="text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase">Inversión total</div>
          <div className="text-[20px] font-bold text-primary mt-1 leading-tight">
            C${totalInvested.toLocaleString('es-NI', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">lo que has pagado en total</div>
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
