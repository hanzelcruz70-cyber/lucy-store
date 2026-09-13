'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

// ====== Piezas de diseño v2 ======
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

const Avatar = ({ name }) => (
  <div className="w-[38px] h-[38px] rounded-full flex-none bg-primary-fixed text-primary flex items-center justify-center text-[15px] font-bold">
    {name?.[0]?.toLowerCase() || '?'}
  </div>
);

const estadoCliente = (movs, balance) => {
  if (balance <= 0) return { label: 'Al corriente', kind: 'ok' };
  const fiados = (movs || []).filter((m) => m.type === 'FIADO');
  if (fiados.length === 0) return { label: 'Debe', kind: 'warn' };
  const ultimo = new Date(fiados[0].date);
  const dias = Math.floor((Date.now() - ultimo.getTime()) / 86400000);
  if (dias >= 30) return { label: dias >= 60 ? '60+ días' : '30-60 días', kind: 'bad' };
  if (dias >= 7) return { label: 'Moroso', kind: 'bad' };
  if (dias >= 3) return { label: 'Pendiente', kind: 'warn' };
  return { label: 'Debe', kind: 'warn' };
};

export default function ClientsList({ withDebt, current, debtByClient, totalDebt, recovered, movsByClient }) {
  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [items, setItems] = useState({ withDebt, current, debtByClient });
  const [recoveredNow, setRecoveredNow] = useState(recovered);

  const [sheet, setSheet] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [fiadoAmount, setFiadoAmount] = useState('');
  const [sheetMode, setSheetMode] = useState('info');
  const [editForm, setEditForm] = useState({ name: '', phone: '', tiktok: '' });

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', tiktok: '' });
  const [newError, setNewError] = useState('');

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const balanceOf = (c) => items.debtByClient[c.id] || 0;

  const listFor = (t) => {
    if (t === 'todos') return [...items.withDebt, ...items.current];
    if (t === 'debt') return items.withDebt;
    return items.current;
  };

  const openSheet = (c) => {
    setAmount('');
    setFiadoAmount('');
    setMethod('efectivo');
    setSheetMode('info');
    setEditForm({ name: c.name || '', phone: c.phone || '', tiktok: c.tiktok || '' });
    setSheet({ client: c, balance: balanceOf(c) });
  };

  // ---------- AGREGAR ----------
  const saveClient = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNewError('');
    try {
      const supabase = createClient();
      const ctx = await getMyContext();
      const name = newForm.name.trim();
      if (!name) throw new Error('El nombre es obligatorio');

      if (isOffline()) {
        // ===== MODO OFFLINE: cliente nuevo local =====
        enqueueOp({ type: 'client_new', payload: { name, phone: newForm.phone.trim(), tiktok: newForm.tiktok.trim() } });
        setItems((it) => ({
          ...it,
          current: [
            { id: uuid(), name, phone: newForm.phone.trim() || null, tiktok: newForm.tiktok.trim() || null, is_live_client: false },
            ...it.current,
          ],
        }));
        setNewForm({ name: '', phone: '', tiktok: '' });
        setNewOpen(false);
        setTab('todos');
        showToast(`Cliente "${name}" guardado (se sincroniza solo)`);
        return;
      }

      // Advertir si ya existe un cliente con el mismo nombre (evita duplicados)
      const { data: existing } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', name)
        .limit(1);
      if (existing && existing.length > 0) {
        const ok = confirm(
          `Ya existe un cliente llamado "${existing[0].name}".\n\n` +
            `¿Seguro que quieres crear OTRO con el mismo nombre?\n` +
            `Tener duplicados confunde los fiados y los abonos.\n\n` +
            `ACEPTAR: crear de todas formas. CANCELAR: no crear.`
        );
        if (!ok) {
          setBusy(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name,
          phone: newForm.phone.trim() || null,
          tiktok: newForm.tiktok.trim() || null,
          store_id: ctx.storeId,
        })
        .select('id, name, phone, tiktok, is_live_client')
        .single();
      if (error) throw error;
      setItems((it) => ({ ...it, current: [data, ...it.current] }));
      setNewForm({ name: '', phone: '', tiktok: '' });
      setNewOpen(false);
      setTab('todos');
      showToast(`Cliente "${name}" agregado`);
    } catch (err) {
      setNewError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- EDITAR ----------
  const saveEdit = async (e) => {
    e.preventDefault();
    if (!sheet || busy) return;
    const name = editForm.name.trim();
    if (!name) {
      showToast('El nombre es obligatorio', false);
      return;
    }
    setBusy(true);
    try {
      const c = sheet.client;
      if (isOffline()) {
        // ===== MODO OFFLINE: edición local =====
        enqueueOp({
          type: 'client_edit',
          payload: { clientId: c.id, name, phone: editForm.phone.trim(), tiktok: editForm.tiktok.trim() },
        });
        applyClientEdit(c.id, { name, phone: editForm.phone.trim() || null, tiktok: editForm.tiktok.trim() || null });
        setSheetMode('info');
        showToast('Cambios guardados (se sincronizan solos)');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase
        .from('clients')
        .update({
          name,
          phone: editForm.phone.trim() || null,
          tiktok: editForm.tiktok.trim() || null,
        })
        .eq('id', c.id);
      if (error) throw error;
      applyClientEdit(c.id, { name, phone: editForm.phone.trim() || null, tiktok: editForm.tiktok.trim() || null });
      setSheetMode('info');
      showToast('Cliente actualizado');
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const applyClientEdit = (clientId, patch) => {
    setItems((it) => ({
      withDebt: it.withDebt.map((c) => (c.id === clientId ? { ...c, ...patch } : c)),
      current: it.current.map((c) => (c.id === clientId ? { ...c, ...patch } : c)),
      debtByClient: it.debtByClient,
    }));
    setSheet((s) => (s && s.client.id === clientId ? { ...s, client: { ...s.client, ...patch } } : s));
  };

  // ---------- ABONAR ----------
  const confirmAbono = async (e) => {
    e.preventDefault();
    if (!sheet || busy) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > sheet.balance) {
      const excedente = amt - sheet.balance;
      const ok = confirm(
        `El abono (C$${amt.toLocaleString('es-NI')}) supera la deuda (C$${sheet.balance.toLocaleString('es-NI')}).\n\n` +
          `Sobran C$${excedente.toLocaleString('es-NI')}. ¿Deseas dar el cambio/vuelto al cliente?\n\n` +
          `ACEPTAR: se registra solo C$${sheet.balance.toLocaleString('es-NI')} y la deuda queda saldada.\n` +
          `CANCELAR: vuelve para corregir el monto.`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const c = sheet.client;

      // Si el abono excede la deuda, registrar solo hasta el saldo (el resto es vuelto)
      const montoReal = Math.min(amt, sheet.balance);

      if (isOffline()) {
        // ===== MODO OFFLINE: abono local =====
        enqueueOp({
          type: 'abono',
          payload: {
            localId: uuid(),
            clientId: c.id,
            amount: montoReal,
            method,
          },
        });
        // Offline: descuento local desde el snapshot (el sincronizador recalcula
        // el balance desde las deudas reales al subir, así que no acumula drift)
        const newBalance = Math.max(0, sheet.balance - montoReal);
        setRecoveredNow((r) => r + montoReal);
        setItems((it) => {
          const newDebtByClient = { ...it.debtByClient };
          if (newBalance <= 0) delete newDebtByClient[c.id];
          else newDebtByClient[c.id] = newBalance;
          const moved = it.withDebt.find((x) => x.id === c.id);
          return {
            withDebt: newBalance <= 0 ? it.withDebt.filter((x) => x.id !== c.id) : it.withDebt,
            current: newBalance <= 0 && moved ? [moved, ...it.current] : it.current,
            debtByClient: newDebtByClient,
          };
        });
        setSheet(null);
        const msg =
          amt > sheet.balance
            ? `Abono de ${money(montoReal)} guardado (vuelto ${money(amt - montoReal)}). Se sincroniza solo.`
            : `Abono de ${money(montoReal)} guardado. Se sincroniza solo.`;
        showToast(msg);
        return;
      }

      const supabase = createClient();
      const ctx = await getMyContext();

      // Leer las deudas pendientes primero para vincular el pago a la más antigua
      // (sin debt_id el abono no aparece en el historial del cliente)
      const { data: clientDebts, error: errFetch } = await supabase
        .from('debts')
        .select('id, remaining')
        .eq('client_id', c.id)
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true });
      if (errFetch) throw new Error('No se pudieron leer las deudas: ' + errFetch.message);

      const { error: errPay } = await supabase.from('payments').insert({
        amount: montoReal,
        method,
        debt_id: (clientDebts || [])[0]?.id || null,
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (errPay) throw new Error('No se registró el pago: ' + errPay.message);

      let remainingAmt = montoReal;

      for (const d of clientDebts || []) {
        if (remainingAmt <= 0) break;
        const take = Math.min(remainingAmt, Number(d.remaining));
        const newRemaining = Number(d.remaining) - take;
        const { error: errUpd, data: updData } = await supabase
          .from('debts')
          .update({ remaining: newRemaining, status: newRemaining <= 0 ? 'saldada' : 'pendiente' })
          .eq('id', d.id)
          .select('remaining')
          .single();
        if (errUpd) throw new Error('No se pudo descontar la deuda: ' + errUpd.message);
        if (Math.abs(Number(updData?.remaining) - newRemaining) > 0.01) {
          throw new Error('La deuda no se descontó correctamente');
        }
        remainingAmt -= take;
      }

      // Saldo NUEVO desde la BD (suma de deudas pendientes), no desde el
      // snapshot: dos abonos seguidos sin recargar calculan bien.
      const { data: openDebts, error: errOpen } = await supabase
        .from('debts')
        .select('remaining')
        .eq('client_id', c.id)
        .eq('status', 'pendiente');
      if (errOpen) throw new Error('No se pudo leer el saldo nuevo: ' + errOpen.message);
      const newBalance = (openDebts || []).reduce((a, d) => a + Number(d.remaining), 0);
      const { error: errBal, data: balData } = await supabase
        .from('clients')
        .update({ balance: newBalance })
        .eq('id', c.id)
        .select('balance')
        .single();
      if (errBal) throw new Error('No se actualizó el saldo: ' + errBal.message);
      if (Math.abs(Number(balData?.balance) - newBalance) > 0.01) {
        throw new Error('El saldo quedó en ' + balData.balance + ' en lugar de ' + newBalance);
      }

      setRecoveredNow((r) => r + montoReal);
      setItems((it) => {
        const newDebtByClient = { ...it.debtByClient };
        if (newBalance <= 0) delete newDebtByClient[c.id];
        else newDebtByClient[c.id] = newBalance;
        const moved = it.withDebt.find((x) => x.id === c.id);
        return {
          withDebt: newBalance <= 0 ? it.withDebt.filter((x) => x.id !== c.id) : it.withDebt,
          current: newBalance <= 0 && moved ? [moved, ...it.current] : it.current,
          debtByClient: newDebtByClient,
        };
      });

      setSheet(null);
      const msg =
        amt > sheet.balance
          ? `Abono de ${money(montoReal)} confirmado (vuelto de ${money(amt - montoReal)}). Deuda saldada.`
          : `Abono de ${money(montoReal)} confirmado. Nuevo saldo: ${money(newBalance)}`;
      showToast(msg);
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  // ---------- FIADO ----------
  const confirmFiado = async (e) => {
    e.preventDefault();
    if (!sheet || busy) return;
    const amt = parseFloat(fiadoAmount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    try {
      const c = sheet.client;

      if (isOffline()) {
        // ===== MODO OFFLINE: fiado directo local =====
        enqueueOp({
          type: 'fiado_directo',
          payload: { localId: uuid(), clientId: c.id, amount: amt },
        });
        const newBalance = (sheet.balance || 0) + amt;
        setItems((it) => {
          const newDebtByClient = { ...it.debtByClient, [c.id]: newBalance };
          const stillCurrent = it.current.some((x) => x.id === c.id);
          return {
            withDebt: it.withDebt.some((x) => x.id === c.id) ? it.withDebt : [c, ...it.withDebt],
            current: stillCurrent ? it.current.filter((x) => x.id !== c.id) : it.current,
            debtByClient: newDebtByClient,
          };
        });
        setSheet(null);
        showToast(`Fiado de ${money(amt)} guardado (se sincroniza solo)`);
        return;
      }

      const supabase = createClient();
      const ctx = await getMyContext();

      const { error: errDebt } = await supabase.from('debts').insert({
        client_id: c.id,
        original_amount: amt,
        remaining: amt,
        description: 'Fiado directo',
        status: 'pendiente',
        store_id: ctx.storeId,
        user_id: ctx.userId,
      });
      if (errDebt) throw errDebt;

      const newBalance = (sheet.balance || 0) + amt;
      const { error: errBal } = await supabase
        .from('clients')
        .update({ balance: newBalance })
        .eq('id', c.id);
      if (errBal) throw errBal;

      setItems((it) => {
        const newDebtByClient = { ...it.debtByClient, [c.id]: newBalance };
        const stillCurrent = it.current.some((x) => x.id === c.id);
        return {
          withDebt: it.withDebt.some((x) => x.id === c.id) ? it.withDebt : [c, ...it.withDebt],
          current: stillCurrent ? it.current.filter((x) => x.id !== c.id) : it.current,
          debtByClient: newDebtByClient,
        };
      });

      setSheet(null);
      showToast(`Fiado de ${money(amt)} registrado a ${c.name}`);
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  // ---------- ELIMINAR ----------
  const eliminarCliente = async (clientArg) => {
    if (busy) return;
    const c = clientArg || sheet?.client;
    if (!c) return;
    const ok = confirm(`¿Eliminar a "${c.name}"?\n\nSe borrarán también sus ${money(balanceOf(c))} de deuda y su historial.`);
    if (!ok) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('clients').delete().eq('id', c.id);
      if (error) throw error;
      setItems((it) => {
        const newDebtByClient = { ...it.debtByClient };
        delete newDebtByClient[c.id];
        return {
          withDebt: it.withDebt.filter((x) => x.id !== c.id),
          current: it.current.filter((x) => x.id !== c.id),
          debtByClient: newDebtByClient,
        };
      });
      setSheet(null);
      showToast(`Cliente "${c.name}" eliminado`);
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary';

  // Búsqueda tolerante: ignora espacios extra y acentos ("dona lupe" encuentra "Doña Lupe")
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const visible = listFor(tab).filter((c) =>
    norm(c.name + ' ' + (c.phone || '') + ' ' + (c.tiktok || '')).includes(norm(search))
  );

  const totalDebtNow = Object.values(items.debtByClient).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface-container-low border border-outline rounded-[14px] p-3.5">
          <Label>Fiado en calle</Label>
          <div className="text-[24px] font-bold text-on-surface mt-1.5 leading-tight">{money(totalDebtNow)}</div>
          <div className="text-[12px] text-on-surface-variant mt-0.5 flex items-center gap-1">
            <span className="w-[7px] h-[7px] rounded-full bg-primary inline-block" />
            {items.withDebt.length} clientes con deuda
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5">
          <Label>Recuperado</Label>
          <div className="text-[24px] font-bold text-primary mt-1.5 leading-tight">{money(recoveredNow)}</div>
          <div className="text-[12px] text-on-surface-variant mt-0.5">en abonos</div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, apodo o cel…"
          className="flex-1 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant bg-transparent"
          type="search"
        />
      </div>

      {/* Chips */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab('todos')}
          className={`flex-1 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
            tab === 'todos' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
          }`}
        >
          Todos ({items.withDebt.length + items.current.length})
        </button>
        <button
          onClick={() => setTab('debt')}
          className={`flex-1 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
            tab === 'debt' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
          }`}
        >
          Con deuda ({items.withDebt.length})
        </button>
        <button
          onClick={() => setTab('current')}
          className={`flex-1 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
            tab === 'current' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
          }`}
        >
          Al corriente ({items.current.length})
        </button>
      </div>

      {/* Agregar */}
      <button
        onClick={() => setNewOpen(true)}
        className="w-full py-3 rounded-xl bg-inverse-surface text-inverse-on-surface text-[13.5px] font-semibold flex items-center justify-center gap-2 active:opacity-85 transition-opacity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="10" cy="8" r="3.4" />
          <path d="M4 20c1.4-3.4 3.6-5 6-5 1.6 0 3 .6 4.2 1.7M18 8v6M15 11h6" />
        </svg>
        Agregar cliente
      </button>

      {/* Lista */}
      {visible.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-6 text-center">
          <p className="text-[13px] text-on-surface-variant">
            {tab === 'debt' ? 'Nadie debe nada. ¡Cobranza perfecta!' : 'Sin clientes todavía.'}
          </p>
        </div>
      )}
      {visible.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] px-3.5 py-1">
          {visible.map((c) => {
            const balance = balanceOf(c);
            const isDebtor = balance > 0;
            return (
              <div key={c.id} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
                <button
                  onClick={() => openSheet(c)}
                  className="flex flex-1 items-center gap-2.5 min-w-0 text-left active:opacity-70 transition-opacity"
                >
                  <Avatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                      {c.name}
                      {c.is_live_client && (
                        <span className="ml-1.5 inline-block bg-primary-fixed text-primary text-[10px] font-semibold px-1.5 py-[1px] rounded-md align-middle">
                          TikTok
                        </span>
                      )}
                    </b>
                    <span className="block text-[11.5px] text-on-surface-variant truncate">
                      {c.phone || c.tiktok || 'Sin contacto'}
                    </span>
                  </div>
                  {isDebtor ? (
                    <div className="text-right">
                      <span className="block text-[10px] text-on-surface-variant uppercase tracking-wide">Debe</span>
                      <span className="block text-[14px] font-bold text-primary">{money(balance)}</span>
                    </div>
                  ) : (
                    <Badge line>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12l5 5L20 7" />
                      </svg>
                      Al corriente
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditForm({ name: c.name || '', phone: c.phone || '', tiktok: c.tiktok || '' });
                    setSheet({ client: c, balance: balanceOf(c) });
                    setSheetMode('edit');
                  }}
                  disabled={busy}
                  title={`Editar ${c.name}`}
                  aria-label={`Editar ${c.name}`}
                  className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-50 flex-shrink-0"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  onClick={() => eliminarCliente(c)}
                  disabled={busy}
                  title={`Eliminar ${c.name}`}
                  aria-label={`Eliminar ${c.name}`}
                  className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center active:opacity-70 transition-opacity disabled:opacity-50 flex-shrink-0"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== HOJA CLIENTE ===== */}
      {sheet && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setSheet(null)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={sheet.client.name} />
                <div>
                  <b className="block text-[15px] font-bold text-on-surface">{sheet.client.name}</b>
                  <span className={`inline-block mt-0.5 text-[10.5px] font-bold px-2 py-[2px] rounded-md uppercase ${
                    estadoCliente(movsByClient[sheet.client.id], sheet.balance).kind === 'bad'
                      ? 'bg-primary text-on-primary'
                      : estadoCliente(movsByClient[sheet.client.id], sheet.balance).kind === 'warn'
                        ? 'bg-primary-fixed text-primary-deep'
                        : 'bg-primary-fixed text-primary'
                  }`}>
                    {estadoCliente(movsByClient[sheet.client.id], sheet.balance).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setSheet(null)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Saldo */}
            <div className="bg-surface-container-low border border-outline rounded-[14px] p-3.5 mt-3">
              <Label>Saldo pendiente</Label>
              <div className={`text-[24px] font-bold leading-tight mt-1 ${sheet.balance > 0 ? 'text-primary' : 'text-primary'}`}>
                {money(sheet.balance)}
              </div>
            </div>

            {/* MODO INFO: abono directo + movimientos */}
            {sheetMode === 'info' && (
              <div className="mt-3 space-y-3">
                {sheet.balance > 0 ? (
                  <div>
                    <Label className="mb-1.5">Anotar abono</Label>
                    <div className="flex gap-2">
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Monto…"
                        inputMode="decimal"
                        className={inputCls}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (amount && !busy) confirmAbono(e);
                        }}
                        disabled={!amount || busy}
                        className="bg-primary text-on-primary text-[12.5px] font-semibold px-5 rounded-[10px] active:bg-primary-deep transition-colors disabled:opacity-40"
                      >
                        {busy ? '…' : 'ABONAR'}
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => setAmount(String((parseFloat(amount) || 0) + 100))} className="flex-1 bg-surface-container-lowest border border-outline rounded-[9px] py-1.5 text-[12px] font-semibold text-on-surface">
                        +C$100
                      </button>
                      <button onClick={() => setAmount(String((parseFloat(amount) || 0) + 200))} className="flex-1 bg-surface-container-lowest border border-outline rounded-[9px] py-1.5 text-[12px] font-semibold text-on-surface">
                        +C$200
                      </button>
                      <button onClick={() => setAmount(String(sheet.balance))} className="flex-1 bg-inverse-surface text-inverse-on-surface rounded-[9px] py-1.5 text-[12px] font-semibold">
                        Todo
                      </button>
                    </div>
                    <div className="mt-2">
                      <Label className="mb-1.5">Método</Label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMethod('efectivo')}
                          className={`flex-1 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
                            method === 'efectivo' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
                          }`}
                        >
                          Efectivo
                        </button>
                        <button
                          type="button"
                          onClick={() => setMethod('transferencia')}
                          className={`flex-1 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-colors ${
                            method === 'transferencia' ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-outline text-on-surface'
                          }`}
                        >
                          Transferencia
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-primary-fixed border border-primary-fixed-dim rounded-[10px] p-2.5 text-center text-[12.5px] font-semibold text-primary-deep">
                    Cliente al día
                  </div>
                )}

                {/* Acciones — entre el método y los movimientos, visibles sin scroll */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => setSheetMode('fiado')}
                    className="w-full py-3 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13.5px] font-semibold flex items-center justify-center gap-2 active:bg-surface-container transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 3v18M3 12h18" />
                    </svg>
                    Dar nuevo fiado
                  </button>
                  <button
                    onClick={() => eliminarCliente(sheet.client)}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-surface-container-low border border-outline text-error text-[12.5px] font-semibold active:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    Eliminar cliente
                  </button>
                </div>

                {/* Movimientos */}
                <div>
                  <Label className="mb-1.5">Movimientos</Label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {(movsByClient[sheet.client.id] || []).length === 0 && (
                      <p className="py-3 text-center text-[12.5px] italic text-on-surface-variant">Sin movimientos todavía</p>
                    )}
                    {(movsByClient[sheet.client.id] || [])
                      .slice()
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] font-bold px-1.5 py-[2px] rounded-md uppercase whitespace-nowrap ${
                              m.type === 'FIADO' ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'
                            }`}>
                              {m.type}
                            </span>
                            <span className="text-[11px] text-on-surface-variant truncate">
                              {m.description ||
                                new Date(m.date).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </span>
                          <span className={`text-[13px] font-bold shrink-0 ${m.type === 'FIADO' ? 'text-primary' : 'text-primary-deep'}`}>
                            {m.type === 'FIADO' ? '+' : '−'} {money(m.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* MODO EDITAR */}
            {sheetMode === 'edit' && (
              <form className="mt-3 space-y-2.5" onSubmit={saveEdit}>
                <div>
                  <Label className="mb-1.5">Nombre</Label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputCls}
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Teléfono</Label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                    placeholder="Teléfono (opcional)"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">TikTok</Label>
                  <input
                    value={editForm.tiktok}
                    onChange={(e) => setEditForm((f) => ({ ...f, tiktok: e.target.value }))}
                    className={inputCls}
                    placeholder="@usuaria de TikTok (opcional)"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                    {busy ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button type="button" onClick={() => setSheetMode('info')} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                    Volver
                  </button>
                </div>
              </form>
            )}

            {/* MODO FIADO */}
            {sheetMode === 'fiado' && (
              <form className="mt-3 space-y-3" onSubmit={confirmFiado}>
                <div>
                  <Label className="mb-1.5">Monto del fiado</Label>
                  <input
                    value={fiadoAmount}
                    onChange={(e) => setFiadoAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="C$ 0.00"
                    className={inputCls}
                  />
                </div>
                <div className="bg-surface-container-low border border-outline rounded-[10px] px-3.5 py-2.5 flex justify-between items-center">
                  <span className="text-[12.5px] text-on-surface-variant">Saldo tras el fiado</span>
                  <b className="text-[14px] text-primary">{money((sheet.balance || 0) + (parseFloat(fiadoAmount) || 0))}</b>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                    {busy ? 'Registrando…' : 'Registrar fiado'}
                  </button>
                  <button type="button" onClick={() => setSheetMode('info')} className="px-5 rounded-xl bg-surface-container-low border border-outline text-on-surface text-[13px] font-semibold">
                    Volver
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal nuevo cliente */}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setNewOpen(false)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <b className="text-[16px] text-on-surface">Agregar cliente</b>
              <button onClick={() => setNewOpen(false)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <form className="space-y-2.5" onSubmit={saveClient}>
              <input required value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Nombre *" />
              <input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="Teléfono" />
              <input value={newForm.tiktok} onChange={(e) => setNewForm((f) => ({ ...f, tiktok: e.target.value }))} className={inputCls} placeholder="@usuaria de TikTok (opcional)" />
              {newError && <p className="text-[12px] text-error font-semibold">{newError}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60">
                {busy ? 'Guardando…' : 'Guardar cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 inset-x-4 z-[60] flex justify-center pointer-events-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]">
          <div className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-[13px] font-semibold ${toast.ok ? 'bg-primary text-on-primary' : 'bg-inverse-surface text-inverse-on-surface'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {toast.ok ? <path d="M4 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
