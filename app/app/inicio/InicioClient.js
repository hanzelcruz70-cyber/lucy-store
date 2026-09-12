'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { getMyContext } from '@/lib/get-store';
import { isOffline, enqueueOp, uuid } from '@/lib/offline-queue';

const money = (n) => 'C$' + (Number(n) || 0).toLocaleString('es-NI', { maximumFractionDigits: 0 });

const Label = ({ children, className = '' }) => (
  <div className={`text-[11px] font-semibold text-on-surface-variant tracking-[0.06em] uppercase flex items-center gap-1.5 ${className}`}>
    {children}
  </div>
);

const LiveDot = () => <span className="w-[7px] h-[7px] rounded-full bg-primary flex-none" />;

const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap bg-primary-fixed text-primary">
    {children}
  </span>
);

const Thumb = ({ children, round = false }) => (
  <div
    className={`w-[38px] h-[38px] ${round ? 'rounded-full' : 'rounded-[10px]'} flex-none bg-primary-fixed text-primary flex items-center justify-center`}
  >
    {children}
  </div>
);

const IcoIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 5l-7 7 7 7M9 5H5v14h4" />
  </svg>
);
const IcoOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 5l7 7-7 7M15 5h4v14h-4" />
  </svg>
);
const IcoAbono = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 7-8" />
    <path d="M14 7h6v6" />
  </svg>
);

const SearchField = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93707F" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="flex-1 text-[12.5px] text-on-surface outline-none placeholder:text-on-surface-variant bg-transparent min-w-0"
      type="search"
    />
  </div>
);

export default function InicioClient({ contado, fiado, abonos, gastos, piezas, sales, expenses, payments: initialPayments, debtors, folioByMov, debtorNameByPayment = {}, movsByClient: initialMovsByClient = {} }) {
  const [movSearch, setMovSearch] = useState('');
  const [cliSearch, setCliSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [debtList, setDebtList] = useState(debtors);
  // Métrica de abonos EN VIVO: crece al registrar un abono sin recargar
  const [abonosVivo, setAbonosVivo] = useState(abonos);
  // Espejo local de pagos: al abonar, el movimiento aparece EN VIVO sin recargar
  const [payments, setPayments] = useState(initialPayments);
  // Historial de movimientos por cliente (se actualiza en vivo al abonar)
  const [movsByClient, setMovsByClient] = useState(initialMovsByClient);

  const [abono, setAbono] = useState(null); // cliente al que se abona
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');

  const showToast = (m, ok = true) => {
    setToast({ m, ok });
    setTimeout(() => setToast(null), 2600);
  };

  const openAbono = (c) => {
    setAmount('');
    setMethod('efectivo');
    setAbono(c);
  };

  const submitAbono = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      showToast('Escribe el monto del abono', false);
      return;
    }
    confirmAbono({ preventDefault: () => {} });
  };

  const confirmAbono = async (e) => {
    e.preventDefault();
    if (!abono || busy) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > abono.balance) {
      const excedente = amt - abono.balance;
      const ok = confirm(
        `El abono (C$${amt.toLocaleString('es-NI')}) supera la deuda (C$${abono.balance.toLocaleString('es-NI')}).\n\n` +
          `Sobran C$${excedente.toLocaleString('es-NI')}. ¿Deseas dar el cambio/vuelto al cliente?\n\n` +
          `ACEPTAR: se registra solo C$${abono.balance.toLocaleString('es-NI')} y la deuda queda saldada.\n` +
          `CANCELAR: vuelve para corregir el monto.`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      // Si el abono excede la deuda, registrar solo hasta el saldo (el resto es vuelto)
      const montoReal = Math.min(amt, abono.balance);

      if (isOffline()) {
        // ===== MODO OFFLINE: abono local =====
        enqueueOp({
          type: 'abono',
          payload: {
            localId: uuid(),
            clientId: abono.id,
            amount: montoReal,
            method,
          },
        });
        const newBalance = Math.max(0, abono.balance - montoReal);
        setDebtList((list) =>
          newBalance <= 0
            ? list.filter((c) => c.id !== abono.id)
            : list.map((c) => (c.id === abono.id ? { ...c, balance: newBalance } : c))
        );
        setMovsByClient((movs) => {
          const list = [...(movs[abono.id] || [])];
          list.unshift({
            id: 'p-off-' + Date.now(),
            type: 'ABONO',
            amount: montoReal,
            description: null,
            date: new Date().toISOString(),
          });
          return { ...movs, [abono.id]: list };
        });
        const offFolioNum =
          Math.max(
            0,
            ...[...sales, ...payments, ...expenses].reduce(
              (acc, m) => {
                const n = parseInt(String(folioByMov[m.id] || '').replace('#', ''), 10);
                acc.push(isNaN(n) ? 0 : n);
                return acc;
              },
              [0]
            )
          ) + 1;
        setPayments((list) => [
          { id: 'p-off-' + Date.now(), sale_id: null, debt_id: null, amount: montoReal, method, created_at: new Date().toISOString(), _clientName: abono.name, _folio: '#' + String(offFolioNum).padStart(3, '0') },
          ...list,
        ]);
        setAbonosVivo((a) => a + montoReal);
        setAbono(null);
        const msg =
          amt > abono.balance
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
        .eq('client_id', abono.id)
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

      let remaining = montoReal;

      for (const d of clientDebts || []) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(d.remaining));
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
        remaining -= take;
      }

      const newBalance = Math.max(0, abono.balance - montoReal);
      const { error: errBal, data: balData } = await supabase
        .from('clients')
        .update({ balance: newBalance })
        .eq('id', abono.id)
        .select('balance')
        .single();
      if (errBal) throw new Error('No se actualizó el saldo: ' + errBal.message);
      if (Math.abs(Number(balData?.balance) - newBalance) > 0.01) {
        throw new Error('El saldo quedó en ' + balData.balance + ' en lugar de ' + newBalance);
      }

      setDebtList((list) =>
        newBalance <= 0
          ? list.filter((c) => c.id !== abono.id)
          : list.map((c) => (c.id === abono.id ? { ...c, balance: newBalance } : c))
      );

      // Insertar el abono EN VIVO en los movimientos de hoy (sin recargar la página)
      const nextFolioNum =
        Math.max(
          0,
          ...[...sales, ...payments, ...expenses].reduce(
            (acc, m) => {
              const n = parseInt(String(folioByMov[m.id] || '').replace('#', ''), 10);
              acc.push(isNaN(n) ? 0 : n);
              return acc;
            },
            [0]
          )
        ) + 1;
      const livePaymentId = 'p-live-' + Date.now();
      const liveFolio = '#' + String(nextFolioNum).padStart(3, '0');
      setPayments((list) => [
        { id: livePaymentId, sale_id: null, debt_id: null, amount: montoReal, method, created_at: new Date().toISOString(), _clientName: abono.name, _folio: liveFolio },
        ...list,
      ]);
      setAbonosVivo((a) => a + montoReal);

      // Agregar el abono al historial del cliente EN VIVO (registro de cuánto abonó y cuándo)
      setMovsByClient((movs) => {
        const list = [...(movs[abono.id] || [])];
        list.unshift({
          id: 'p-live-' + Date.now(),
          type: 'ABONO',
          amount: montoReal,
          description: null,
          date: new Date().toISOString(),
        });
        return { ...movs, [abono.id]: list };
      });

      setAbono(null);
      const msg =
        amt > abono.balance
          ? `Abono de ${money(montoReal)} confirmado (vuelto de ${money(amt - montoReal)}). Deuda saldada.`
          : `Abono de ${money(montoReal)} confirmado. Nuevo saldo: ${money(newBalance)}`;
      showToast(msg);
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const remainingCalc = abono ? Math.max(0, abono.balance - (parseFloat(amount) || 0)) : 0;

  // Línea de tiempo de movimientos con folio único
  const movimientos = [
    ...sales.map((s) => ({
      key: s.id,
      folio: folioByMov[s.id] || '',
      tipo: s.payment_method === 'fiado' ? 'fiado' : 'venta',
      titulo: `${s.client_name || 'Venta mostrador'}${s.notes ? ' · ' + s.notes : ''}`,
      sub: `${new Date(s.created_at).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' })} · ${
        s.payment_method === 'fiado' ? 'Fiado' : 'Contado'
      }${s.channel === 'tiktok_live' ? ' · Live' : ''}`,
      monto: Number(s.total),
      signo: '+',
      ts: s.created_at,
    })),
    ...payments.map((p) => ({
      key: p.id,
      folio: p._folio || folioByMov[p.id] || '',
      tipo: 'abono',
      titulo: p._clientName || debtorNameByPayment[p.id] ? `Abono recibido · ${p._clientName || debtorNameByPayment[p.id]}` : 'Abono recibido',
      sub: `${new Date(p.created_at).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' })} · ${
        p.method === 'efectivo' ? 'Efectivo' : 'Transferencia'
      }`,
      monto: Number(p.amount),
      signo: '+',
      ts: p.created_at,
    })),
    ...expenses.map((e) => ({
      key: e.id,
      folio: folioByMov[e.id] || '',
      tipo: 'gasto',
      titulo: e.concept,
      sub: `${new Date(e.created_at).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' })} · Gasto · ${e.category}`,
      monto: Number(e.amount),
      signo: '−',
      ts: e.created_at,
    })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts));

  // Búsqueda tolerante (ignora acentos y espacios extra) para deudores y movimientos
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const movsFiltrados = movimientos.filter((m) => {
    if (!movSearch.trim()) return true;
    const q = norm(movSearch);
    return (
      norm(m.folio).includes(q) ||
      norm(m.titulo).includes(q) ||
      norm(m.sub).includes(q)
    );
  });

  const cliFiltrados = debtList.filter((c) => {
    if (!cliSearch.trim()) return true;
    const q = norm(cliSearch);
    return norm(c.name + ' ' + (c.phone || '')).includes(q);
  });

  return (
    <div className="flex flex-col w-full px-3.5 py-3.5 gap-2.5">
      {/* ===== 4 métricas ===== */}
      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5">
        <Label>
          <LiveDot /> Caja del día · {piezas} prendas
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <div className="bg-surface-container-low border border-outline rounded-[10px] p-2.5">
            <Label>Contado</Label>
            <div className="text-[20px] font-bold text-primary mt-1 leading-tight">{money(contado)}</div>
          </div>
          <div className="bg-surface-container-low border border-outline rounded-[10px] p-2.5">
            <Label>Fiado</Label>
            <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">{money(fiado)}</div>
          </div>
          <div className="bg-surface-container-low border border-outline rounded-[10px] p-2.5">
            <Label>Abonos</Label>
            <div className="text-[20px] font-bold text-primary mt-1 leading-tight">{money(abonosVivo)}</div>
          </div>
          <div className="bg-surface-container-low border border-outline rounded-[10px] p-2.5">
            <Label>Gastos</Label>
            <div className="text-[20px] font-bold text-on-surface mt-1 leading-tight">−{money(gastos)}</div>
          </div>
        </div>
      </div>

      {/* ===== Movimientos (cajita con scroll) ===== */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Movimientos de hoy</b>
        <Badge>{movimientos.length}</Badge>
      </div>

      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-2">
        <SearchField
          value={movSearch}
          onChange={(e) => setMovSearch(e.target.value)}
          placeholder="Buscar por folio (#001), cliente o concepto…"
        />
        {movsFiltrados.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-on-surface-variant">
            {movimientos.length === 0 ? 'Aún no hay movimientos hoy.' : 'Sin coincidencias.'}
          </p>
        )}
        {movsFiltrados.length > 0 && (
          <div
            className="space-y-0 overflow-y-auto pr-1 scroll-box"
            style={movsFiltrados.length > 5 ? { maxHeight: 340 } : undefined}
          >
            {movsFiltrados.map((m) => (
              <div key={m.key} className="flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0">
                <Thumb>
                  {m.tipo === 'gasto' ? <IcoOut /> : m.tipo === 'abono' ? <IcoAbono /> : <IcoIn />}
                </Thumb>
                <div className="flex-1 min-w-0">
                  <b className="block text-[13.5px] font-semibold text-on-surface truncate">
                    <span className="inline-block bg-primary-fixed text-primary text-[10px] font-bold px-1.5 py-[1px] rounded-md mr-1.5 align-middle">
                      {m.folio}
                    </span>
                    {m.titulo}
                  </b>
                  <span className="block text-[11.5px] text-on-surface-variant truncate">{m.sub}</span>
                </div>
                <span
                  className={`text-[14px] font-bold whitespace-nowrap ${m.tipo === 'gasto' ? 'text-on-surface' : 'text-primary'}`}
                >
                  {m.signo}
                  {money(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
        {movimientos.length > 5 && (
          <p className="text-center text-[10.5px] text-on-surface-variant uppercase tracking-wide">
            {movsFiltrados.length > 5 ? 'Desplázate para ver más ↓' : ''}
          </p>
        )}
      </div>

      {/* ===== Clientes que deben (cajita con scroll) ===== */}
      <div className="flex justify-between items-center px-0.5">
        <b className="text-[14px] text-on-surface">Clientes que deben</b>
        <Badge>{debtList.length}</Badge>
      </div>

      <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-3.5 space-y-2">
        {debtList.length > 5 && (
          <SearchField
            value={cliSearch}
            onChange={(e) => setCliSearch(e.target.value)}
            placeholder="Buscar cliente…"
          />
        )}
        {cliFiltrados.length === 0 && (
          <div className="py-4 text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <path d="M4 12l5 5L20 7" />
            </svg>
            <p className="text-[12.5px] text-on-surface-variant mt-1">
              {debtList.length === 0 ? 'Nadie te debe nada. ¡Cobranza perfecta!' : 'Sin coincidencias.'}
            </p>
          </div>
        )}
        {cliFiltrados.length > 0 && (
          <div
            className="space-y-0 overflow-y-auto pr-1 scroll-box"
            style={cliFiltrados.length > 5 ? { maxHeight: 340 } : undefined}
          >
            {cliFiltrados.map((c) => (
              <button
                key={c.id}
                onClick={() => openAbono(c)}
                className="w-full flex items-center gap-2.5 py-2.5 border-b border-surface-container last:border-0 text-left active:opacity-70 transition-opacity"
              >
                <Thumb round>{c.name?.[0]?.toLowerCase()}</Thumb>
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
                    {c.phone || 'Sin contacto'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-on-surface-variant uppercase tracking-wide">Debe</span>
                  <span className="block text-[14px] font-bold text-primary">{money(c.balance)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de abono */}
      {abono && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setAbono(null)}>
          <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Thumb round>{abono.name?.[0]?.toLowerCase()}</Thumb>
                <div>
                  <b className="block text-[15px] font-bold text-on-surface">{abono.name}</b>
                  <span className="text-[11px] text-on-surface-variant">{abono.phone || 'Sin contacto'}</span>
                </div>
              </div>
              <button onClick={() => setAbono(null)} className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="bg-surface-container-low border border-outline rounded-[14px] p-3.5 mt-3">
              <Label>Saldo pendiente</Label>
              <div className="text-[24px] font-bold text-primary leading-tight mt-1">{money(abono.balance)}</div>
            </div>

            <form className="mt-3 space-y-3" onSubmit={confirmAbono}>
              <div>
                <Label className="mb-1.5">Anotar abono</Label>
                <div className="flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="Monto…"
                    className="flex-1 bg-surface-container-lowest border border-outline rounded-[10px] px-3 py-2.5 text-[13px] text-on-surface font-semibold outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={submitAbono}
                    disabled={busy}
                    className="bg-primary text-on-primary text-[12.5px] font-semibold px-5 rounded-[10px] active:bg-primary-deep transition-colors disabled:opacity-40"
                  >
                    {busy ? '…' : 'ABONAR'}
                  </button>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => setAmount(String((parseFloat(amount) || 0) + 100))} className="flex-1 bg-surface-container-lowest border border-outline rounded-[9px] py-1.5 text-[12px] font-semibold text-on-surface">
                    +C$100
                  </button>
                  <button type="button" onClick={() => setAmount(String((parseFloat(amount) || 0) + 200))} className="flex-1 bg-surface-container-lowest border border-outline rounded-[9px] py-1.5 text-[12px] font-semibold text-on-surface">
                    +C$200
                  </button>
                  <button type="button" onClick={() => setAmount(String(abono.balance))} className="flex-1 bg-inverse-surface text-inverse-on-surface rounded-[9px] py-1.5 text-[12px] font-semibold">
                    Todo
                  </button>
                </div>
              </div>

              <div>
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

              <div className="bg-surface-container-low border border-outline rounded-[10px] px-3.5 py-2.5 flex justify-between items-center">
                <span className="text-[12.5px] text-on-surface-variant">Nuevo saldo</span>
                <b className={`text-[15px] ${remainingCalc === 0 && (parseFloat(amount) || 0) > 0 ? 'text-primary' : 'text-on-surface'}`}>
                  {money(remainingCalc)}
                </b>
              </div>

              <div>
                <Label className="mb-1.5">Movimientos del cliente</Label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {(movsByClient[abono.id] || []).length === 0 && (
                    <p className="py-3 text-center text-[12.5px] italic text-on-surface-variant">Sin movimientos todavía</p>
                  )}
                  {(movsByClient[abono.id] || [])
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
