'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const Label = ({ children, className = '' }) => (
  <div className={`text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1.5 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, dark = false, line = false }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap ${
      dark
        ? 'bg-inverse-surface text-inverse-on-surface'
        : line
          ? 'bg-surface-container-lowest border border-primary-fixed-dim text-primary'
          : 'bg-primary-fixed text-primary'
    }`}
  >
    {children}
  </span>
);

export default function LiveConsole({ initialSales, initialDebtSaleIds }) {
  const router = useRouter();
  const [sales, setSales] = useState(initialSales);
  const [debtSaleIds, setDebtSaleIds] = useState(new Set(initialDebtSaleIds || []));
  const [client, setClient] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [editSale, setEditSale] = useState(null); // apartado pendiente en edición
  const [editForm, setEditForm] = useState({ client: '', desc: '', price: '' });

  // Validación del precio: solo número positivo razonable (rechaza texto, comas, montos absurdos)
  const setPriceSafe = (raw) => {
    const v = String(raw).replace(/[^0-9.]/g, '');
    setPrice(v);
  };
  const priceNum = parseFloat(price);
  const priceValid = priceNum > 0 && priceNum <= 100000;
  const priceWarn = priceNum > 5000;

  const totalPieces = sales.reduce((a, s) => a + s.items_count, 0);
  const totalAmount = sales.reduce((a, s) => a + Number(s.total), 0);

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const submitHold = async (e) => {
    e.preventDefault();
    if (busy || !client.trim() || !priceValid) return;
    setBusy(true);
    try {
      const amt = parseFloat(price) || 0;
      if (isOffline()) {
        // ===== MODO OFFLINE: apartado local =====
        const localId = uuid();
        enqueueOp({
          type: 'live_hold',
          payload: {
            localId,
            total: amt,
            clientName: client.trim(),
            notes: desc.trim() || null,
          },
        });
        setSales((s) => [
          { id: localId, total: amt, items_count: 1, channel: 'tiktok_live', payment_method: 'fiado', client_name: client.trim(), notes: desc.trim() || null, created_at: new Date().toISOString() },
          ...s,
        ]);
        setClient('');
        setDesc('');
        setPrice('');
        showToast('Prenda apartada (se sincroniza sola)');
        return;
      }
      const supabase = createClient();
      const ctx = await getMyContext();
      const { data, error } = await supabase
        .from('sales')
        .insert({
          total: amt,
          items_count: 1,
          channel: 'tiktok_live',
          payment_method: 'fiado',
          client_name: client.trim(),
          notes: desc.trim() || null,
          store_id: ctx.storeId,
          user_id: ctx.userId,
        })
        .select('id, total, items_count, channel, payment_method, client_name, notes, created_at')
        .single();
      if (error) throw error;
      setSales((s) => [data, ...s]);
      setClient('');
      setDesc('');
      setPrice('');
      showToast('Prenda apartada al vuelo');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (sale) => {
    if (processingId || debtSaleIds.has(sale.id)) return;
    setProcessingId(sale.id);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: cobro local =====
        enqueueOp({
          type: 'live_collect',
          payload: {
            saleLocalId: sale.id,
            paymentLocalId: uuid(),
            amount: Number(sale.total),
          },
        });
        setSales((s) => s.map((x) => (x.id === sale.id ? { ...x, payment_method: 'efectivo' } : x)));
        showToast('Cobrado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const ctx = await getMyContext();

      // IDEMPOTENTE: si un intento anterior ya registró el pago (la red falló
      // justo después del insert), no se duplica — se verifica antes de tocar.
      const { data: existingPay } = await supabase
        .from('payments')
        .select('id')
        .eq('sale_id', sale.id)
        .limit(1);
      if (existingPay && existingPay.length > 0) {
        await supabase.from('sales').update({ payment_method: 'efectivo' }).eq('id', sale.id);
        setSales((s) => s.map((x) => (x.id === sale.id ? { ...x, payment_method: 'efectivo' } : x)));
        showToast('Cobrado y registrado en caja');
        return;
      }

      const { error: errUpd } = await supabase
        .from('sales')
        .update({ payment_method: 'efectivo' })
        .eq('id', sale.id);
      if (errUpd) throw errUpd;
      const { error: errPay } = await supabase.from('payments').insert({
        sale_id: sale.id,
        amount: Number(sale.total),
        method: 'efectivo',
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (errPay) throw errPay;
      setSales((s) => s.map((x) => (x.id === sale.id ? { ...x, payment_method: 'efectivo' } : x)));
      showToast('Cobrado y registrado en caja');
      router.refresh();
    } catch (err) {
      const msg =
        err.message === 'Failed to fetch'
          ? 'Se cayó la conexión. Toca Cobrar de nuevo — no se duplica.'
          : 'Error: ' + err.message;
      showToast(msg, false);
    } finally {
      setProcessingId(null);
    }
  };

  const markFiado = async (sale) => {
    if (processingId) return;
    if (debtSaleIds.has(sale.id)) {
      showToast('Esta venta ya está en cuenta', false);
      return;
    }
    setProcessingId(sale.id);
    try {
      const name = (sale.client_name || 'Cliente Live').trim();
      if (isOffline()) {
        // ===== MODO OFFLINE: fiado local =====
        enqueueOp({
          type: 'live_fiado',
          payload: {
            saleLocalId: sale.id,
            clientName: name,
            amount: Number(sale.total),
            notes: sale.notes || 'Prenda de Live',
          },
        });
        setDebtSaleIds((ids) => new Set(ids).add(sale.id));
        showToast(`Fiado de ${money(Number(sale.total))} guardado (se sincroniza solo)`);
        return;
      }
      const supabase = createClient();
      const ctx = await getMyContext();

      // Verificar PRIMERO si ya existe deuda ligada a esta venta (protección contra doble fiado
      // incluso si la venta se fió desde otra sesión/dispositivo)
      const { data: existingDebt } = await supabase
        .from('debts')
        .select('id')
        .eq('sale_id', sale.id)
        .limit(1);
      if (existingDebt && existingDebt.length > 0) {
        setDebtSaleIds((ids) => new Set(ids).add(sale.id));
        showToast('Esta venta ya está en cuenta', false);
        return;
      }

      const { data: found } = await supabase
        .from('clients')
        .select('id, name, balance')
        .ilike('name', name)
        .limit(5);
      const exact =
        (found || []).find((f) => (f.name || '').toLowerCase() === name.toLowerCase()) || null;

      let clientId;
      let prevBalance = 0;
      if (exact) {
        clientId = exact.id;
        prevBalance = Number(exact.balance || 0);
      } else {
        const { data: newClient, error: errClient } = await supabase
          .from('clients')
          .insert({ name, is_live_client: true, store_id: ctx.storeId, balance: 0 })
          .select('id, balance')
          .single();
        if (errClient) throw errClient;
        clientId = newClient.id;
      }

      const amt = Number(sale.total);
      const { error: errDebt } = await supabase.from('debts').insert({
        client_id: clientId,
        original_amount: amt,
        remaining: amt,
        description: sale.notes || 'Prenda de Live',
        status: 'pendiente',
        sale_id: sale.id,
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (errDebt) throw errDebt;

      const newBalance = prevBalance + amt;
      const { error: errBal, data: balData } = await supabase
        .from('clients')
        .update({ balance: newBalance })
        .eq('id', clientId)
        .select('balance')
        .single();
      if (errBal) throw new Error('No se pudo actualizar el saldo: ' + errBal.message);
      if (Math.abs(Number(balData?.balance) - newBalance) > 0.01) {
        throw new Error('El saldo no se actualizó correctamente');
      }

      setDebtSaleIds((ids) => new Set(ids).add(sale.id));
      showToast(`Deuda de ${money(amt)} registrada a ${name}`);
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setProcessingId(null);
    }
  };

  const fieldCls =
    'flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface-variant';

  /* ===== EDITAR APARTADO PENDIENTE ===== */
  const openEditSale = (s) => {
    setEditForm({
      client: s.client_name || '',
      desc: s.notes || '',
      price: String(Number(s.total)),
    });
    setEditSale(s);
  };

  const saveEditSale = async (e) => {
    e.preventDefault();
    if (!editSale || busy) return;
    const name = editForm.client.trim();
    const priceNum = parseFloat(editForm.price);
    if (!name) {
      showToast('Escribe el nombre del cliente', false);
      return;
    }
    if (!priceNum || priceNum <= 0 || priceNum > 100000) {
      showToast('Precio inválido (hasta C$100,000)', false);
      return;
    }
    setBusy(true);
    try {
      const patch = {
        client_name: name,
        notes: editForm.desc.trim() || null,
        total: priceNum,
      };
      if (isOffline()) {
        // ===== MODO OFFLINE: edición local =====
        enqueueOp({
          type: 'live_edit',
          payload: { saleLocalId: editSale.id, ...patch },
        });
        setSales((list) => list.map((s) => (s.id === editSale.id ? { ...s, ...patch } : s)));
        setEditSale(null);
        showToast('Apartado actualizado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from('sales').update(patch).eq('id', editSale.id);
      if (error) throw error;
      setSales((list) => list.map((s) => (s.id === editSale.id ? { ...s, ...patch } : s)));
      setEditSale(null);
      showToast('Apartado actualizado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  /* ===== ELIMINAR APARTADO PENDIENTE ===== */
  const deleteSale = async (s) => {
    if (busy) return;
    const ok = confirm(
      `¿Eliminar el apartado de ${s.client_name || 'cliente live'} (${money(s.total)})?\n\n` +
        (s.notes || 'Prenda') + ' · Esta acción no se puede deshacer.'
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (isOffline()) {
        // ===== MODO OFFLINE: borrado local =====
        enqueueOp({
          type: 'live_delete',
          payload: { saleLocalId: s.id },
        });
        setSales((list) => list.filter((x) => x.id !== s.id));
        showToast('Apartado eliminado (se sincroniza solo)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from('sales').delete().eq('id', s.id);
      if (error) throw error;
      setSales((list) => list.filter((x) => x.id !== s.id));
      showToast('Apartado eliminado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Contadores en bloque soft */}
      <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[14px] p-3.5">
        <Label className="text-primary-deep">
          <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none" /> Live en curso ·{' '}
          <span className="normal-case tracking-normal font-medium">auto-sincronizado</span>
        </Label>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3">
            <Label>Apartadas hoy</Label>
            <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">
              {totalPieces} <span className="text-[12px] text-on-surface-variant font-medium">piezas</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3">
            <Label>Monto en live</Label>
            <div className="text-[20px] font-bold text-primary mt-1 leading-tight">{money(totalAmount)}</div>
          </div>
        </div>
      </div>

      {/* Apartado ultrarrápido */}
      <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[14px] p-3.5">
        <b className="text-[14px] text-on-surface flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D6337F" strokeWidth="1.9" strokeLinejoin="round">
            <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
          </svg>
          Apartado ultrarrápido
        </b>
        <form className="mt-3 space-y-2" onSubmit={submitHold}>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase mb-1.5">
              Cliente del Live
            </label>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              placeholder="@usuario o Doña Lupita"
              className="w-full bg-surface-container-lowest border border-outline rounded-[12px] px-3.5 py-3.5 text-[15px] font-semibold text-on-surface placeholder:font-normal placeholder:text-on-surface-variant outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="grid grid-cols-[1.5fr_1fr] gap-2">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="#43 Vestido liso"
              className="bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface-variant outline-none focus:border-primary transition-colors"
            />
            <input
              value={price}
              onChange={(e) => setPriceSafe(e.target.value)}
              required
              inputMode="decimal"
              placeholder="C$ 150"
              className="bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-on-surface outline-none focus:border-primary"
            />
          </div>
          {price !== '' && !priceValid && (
            <p className="text-[11px] text-error font-semibold">Escribe un precio válido (hasta C$100,000)</p>
          )}
          {priceWarn && priceValid && (
            <p className="text-[11px] text-on-surface-variant">Precio fuera de lo normal, revisa antes de apartar</p>
          )}
          <div className="text-[12px] text-on-surface-variant mt-3 mb-1.5">Precios rápidos boutique</div>
          <div className="grid grid-cols-6 gap-1.5">
            {[100, 120, 150, 180, 250, 300].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrice(String(p))}
                className={`py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
                  String(p) === price
                    ? 'bg-inverse-surface border-inverse-surface text-inverse-on-surface'
                    : 'bg-surface-container-lowest border-outline text-on-surface'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy || !priceValid}
            className="w-full py-3 mt-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold flex items-center justify-center gap-2 active:bg-primary-deep transition-colors disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            {busy ? 'Apartando…' : 'Apartar prenda al vuelo'}
          </button>
        </form>
      </div>

      {/* Lista de apartados */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Apartados en curso</b>
        <Badge>{sales.length}</Badge>
      </div>

      {sales.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
            <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3" />
          </svg>
          <p className="text-[13px] text-on-surface-variant mt-1.5">Sin apartados aún. ¡Arranca el Live!</p>
        </div>
      )}

      {sales.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
          {sales.map((s) => {
            const paid = s.payment_method !== 'fiado';
            const inDebt = debtSaleIds.has(s.id);
            const processing = processingId === s.id;
            const time = new Date(s.created_at).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' });
            return (
              <div key={s.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="inline-block bg-primary text-on-primary text-[10px] font-bold px-2 py-[2px] rounded-md tracking-wide mr-1.5 align-middle uppercase">
                      {s.notes || 'Prenda'}
                    </span>
                    <b className="text-[13.5px] font-semibold text-on-surface align-middle">{s.client_name || 'Cliente live'}</b>
                  </div>
                  <span className="block text-[11.5px] text-on-surface-variant mt-0.5">{time}</span>
                </div>
                <div className="text-right">
                  <b className="block text-[14px] text-on-surface">{money(s.total)}</b>
                  <div className="mt-[3px]">
                    {paid ? (
                      <Badge line>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7" /></svg>
                        Cobrado
                      </Badge>
                    ) : inDebt ? (
                      <Badge dark>Fiado</Badge>
                    ) : (
                      <Badge>Pendiente</Badge>
                    )}
                  </div>
                </div>
                {!paid && !inDebt && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => markPaid(s)}
                      disabled={processing}
                      title="Cobrar en efectivo"
                      aria-label={`Cobrar apartado de ${s.client_name || 'cliente'}`}
                      className="w-9 h-9 rounded-[10px] bg-primary text-on-primary flex items-center justify-center active:bg-primary-deep disabled:opacity-50 transition-colors"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="6" width="18" height="12" rx="2" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => markFiado(s)}
                      disabled={processing}
                      title="Poner en fiado"
                      aria-label={`Fiar apartado de ${s.client_name || 'cliente'}`}
                      className="w-9 h-9 rounded-[10px] bg-inverse-surface text-inverse-on-surface flex items-center justify-center active:opacity-80 disabled:opacity-50 transition-opacity"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5c2.5-1 5.5-1 8 1 2.5-2 5.5-2 8-1v14c-2.5-1-5.5-1-8 1-2.5-2-5.5-2-8-1z" />
                        <path d="M12 6v14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEditSale(s)}
                      disabled={processing || busy}
                      aria-label={`Editar apartado de ${s.client_name || 'cliente'}`}
                      title="Editar apartado"
                      className="w-9 h-9 rounded-[10px] bg-surface-container-low border border-outline text-on-surface flex items-center justify-center active:opacity-70 disabled:opacity-50 transition-opacity"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteSale(s)}
                      disabled={processing || busy}
                      aria-label={`Eliminar apartado de ${s.client_name || 'cliente'}`}
                      title="Eliminar apartado"
                      className="w-9 h-9 rounded-[10px] bg-surface-container-low border border-outline text-error flex items-center justify-center active:opacity-70 disabled:opacity-50 transition-opacity"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal editar apartado */}
      {editSale && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setEditSale(null)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <b className="text-[16px] text-on-surface">Editar apartado</b>
              <button onClick={() => setEditSale(null)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-[0.06em]">
              Solo apartados pendientes
            </span>
            <form className="mt-3 space-y-2" onSubmit={saveEditSale}>
              <input
                required
                value={editForm.client}
                onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))}
                placeholder="@usuario o Doña Lupita"
                className={fieldCls}
              />
              <div className="grid grid-cols-[1.5fr_1fr] gap-2">
                <input
                  value={editForm.desc}
                  onChange={(e) => setEditForm((f) => ({ ...f, desc: e.target.value }))}
                  placeholder="#43 Vestido liso"
                  className={fieldCls}
                />
                <input
                  required
                  inputMode="decimal"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="C$ 150"
                  className="bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-on-surface outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-6 gap-1.5 mt-1">
                {[100, 120, 150, 180, 250, 300].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, price: String(p) }))}
                    className={`py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
                      String(p) === editForm.price
                        ? 'bg-inverse-surface border-inverse-surface text-inverse-on-surface'
                        : 'bg-surface-container-lowest border-outline text-on-surface'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditSale(null)} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 inset-x-4 z-[60] flex justify-center pointer-events-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]">
          <div className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-[13px] font-semibold ${toast.ok ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {toast.ok ? <path d="M4 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
            <span>{toast.m}</span>
          </div>
        </div>
      )}
    </div>
  );
}
