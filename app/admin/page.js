'use client';

import { useEffect, useState } from 'react';

const Ico = ({ name, size = 22, cls = '' }) => {
  const paths = {
    admin: <path d="M12 3l4 2v5c0 3.5-1.7 5.5-4 7-2.3-1.5-4-3.5-4-7V5zM12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9.5 15.5a2.5 2.5 0 0 1 5 0" />,
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5zM12 15v2" />,
    store: (
      <>
        <path d="M4 10.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5" />
        <path d="M3.5 6.5L5 3h14l1.5 3.5" />
        <path d="M3.5 6.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5" />
        <path d="M9.75 21v-5.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V21" />
      </>
    ),
    add_business: (
      <>
        <path d="M3.5 9.7V17a2 2 0 0 0 2 2h9" />
        <path d="M3 6.5L4.3 3h12.4L18 6.5" />
        <path d="M3 6.5c0 1.3 1 2.3 2.3 2.3S7.6 7.8 7.6 6.5c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3" />
        <path d="M18 14v6M15 17h6" />
      </>
    ),
    person_add: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5M18 5v6M15 8h6" />,
    delete: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      {paths[name]}
    </svg>
  );
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [stores, setStores] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState({ ownerName: '', storeName: '', email: '', password: '' });
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}
  const [busy, setBusy] = useState(false);

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${pass}`,
  });

  const load = async (pw) => {
    const res = await fetch('/api/admin/stores', {
      headers: { Authorization: `Bearer ${pw}` },
    });
    if (res.ok) {
      const data = await res.json();
      setStores(data.stores || []);
      setProfiles(data.profiles || []);
      setAuthed(true);
      setLoginError('');
      return true;
    }
    return false;
  };

  const tryLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const ok = await load(pass);
    if (!ok) setLoginError('Contraseña incorrecta');
  };

  useEffect(() => {
    if (!authed) return;
    load(pass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const createStore = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMsg({ type: 'ok', text: `Tienda "${form.storeName}" creada. Entrega a tu cliente: ${form.email}` });
      setForm({ ownerName: '', storeName: '', email: '', password: '' });
      await load(pass);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteStore = async (userId, storeName) => {
    if (!confirm(`¿Eliminar la tienda "${storeName}" y su dueño? Se borrarán TODOS sus datos.`)) return;
    const res = await fetch('/api/admin/stores', {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Tienda eliminada' });
      await load(pass);
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: d.error || 'Error al eliminar' });
    }
  };

  const patchStore = async (storeId, action, name) => {
    if (action === 'renew') {
      if (!confirm(`¿Registrar pago de 31 días para "${name}"?`)) return;
    }
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ storeId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMsg({
        type: 'ok',
        text:
          action === 'renew'
            ? `Pago registrado: "${name}" activa hasta el ${new Date(data.paid_until).toLocaleDateString('es-NI')}`
            : data.active
              ? `Cuenta "${name}" activada`
              : `Cuenta "${name}" suspendida`,
      });
      await load(pass);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: p }));
  };

  const inputCls =
    'w-full bg-surface-container-lowest px-space-md py-2.5 rounded-lg text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm';

  // ---------- LOGIN DEL ADMIN ----------
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-gutter-mobile py-12 max-w-md mx-auto">
        <div className="w-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg space-y-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-12 h-12 rounded-xl bg-inverse-surface text-inverse-on-surface flex items-center justify-center flex-shrink-0">
              <Ico name="admin" size={26} />
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md text-on-surface">Panel Admin</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Mi Prenda · Solo el dueño del sistema</p>
            </div>
          </div>
          <form onSubmit={tryLogin} className="space-y-space-sm">
            <div>
              <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
                Contraseña de administrador
              </label>
              <input
                type="password"
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>
            {loginError && <p className="font-body-sm text-body-sm text-error font-semibold">{loginError}</p>}
            <button className="w-full min-h-[52px] bg-inverse-surface text-inverse-on-surface rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform">
              <Ico name="lock" size={22} />
              Entrar al panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- PANEL ----------
  return (
    <div className="min-h-screen px-gutter-mobile py-8 max-w-2xl mx-auto space-y-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-xl bg-inverse-surface text-inverse-on-surface flex items-center justify-center">
            <Ico name="admin" size={24} />
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Panel Admin</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {stores.length} tiendas registradas
            </p>
          </div>
        </div>
      </div>

      {/* Crear tienda */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg space-y-space-md">
        <div className="flex items-center gap-2">
          <Ico name="add_business" size={22} cls="text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Crear cuenta de cliente</h2>
        </div>
        <form onSubmit={createStore} className="space-y-space-sm">
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Nombre del dueño
            </label>
            <input required value={form.ownerName} onChange={set('ownerName')} className={inputCls} placeholder="Lucy" />
          </div>
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Nombre del negocio (así lo verá el cliente)
            </label>
            <input
              required
              value={form.storeName}
              onChange={set('storeName')}
              className={inputCls}
              placeholder="Lucy Store"
            />
          </div>
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Correo del cliente
            </label>
            <input required type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="cliente@correo.com" />
          </div>
          <div>
            <label className="block font-body-sm text-body-sm font-medium text-on-surface mb-1">
              Contraseña (se la entregas al cliente)
            </label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                className={inputCls}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={genPassword}
                className="px-4 rounded-lg bg-surface-container-high text-on-surface font-headline-sm text-body-sm flex-shrink-0 active:bg-surface-container-highest"
              >
                Generar
              </button>
            </div>
          </div>

          {msg && (
            <div
              className={`rounded-xl p-space-sm font-body-sm text-body-sm ${
                msg.type === 'ok'
                  ? 'bg-secondary-container/40 text-on-secondary-container'
                  : 'bg-error-container/40 text-on-error-container'
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[52px] bg-primary text-on-primary rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <Ico name="person_add" size={22} />
            {busy ? 'Creando...' : 'Crear tienda y cuenta'}
          </button>
        </form>
      </div>

      {/* Listado de tiendas */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg space-y-space-sm">
        <div className="flex items-center gap-2">
          <Ico name="store" size={22} cls="text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Tiendas del sistema</h2>
        </div>
        {stores.length === 0 && (
          <p className="font-body-md text-body-md text-on-surface-variant">Aún no hay tiendas creadas.</p>
        )}
        <div className="space-y-space-xs">
          {stores.map((s) => {
            const profile = profiles.find((p) => p.store_id === s.id);
            const owner = profile ? `${profile.display_name} · ${s.owner_email}` : s.owner_email;
            const vencida =
              s.active === false ||
              (s.paid_until && new Date(s.paid_until) <= new Date());
            const diasRestantes = s.paid_until
              ? Math.ceil((new Date(s.paid_until) - new Date()) / (24 * 60 * 60 * 1000))
              : null;
            return (
              <div key={s.id} className="bg-surface-container-low rounded-xl p-space-sm space-y-space-sm">
                <div className="flex items-center justify-between gap-space-sm">
                  <div className="min-w-0">
                    <p className="font-headline-sm text-body-md text-on-surface truncate">{s.name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{owner}</p>
                    <p className="font-body-sm text-[11px] text-on-surface-variant">
                      Creada: {new Date(s.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                  <button
                    onClick={() => profile && deleteStore(profile.id, s.name)}
                    className="w-10 h-10 rounded-lg bg-error-container/40 text-error flex items-center justify-center flex-shrink-0 active:scale-95"
                    title="Eliminar tienda"
                  >
                    <Ico name="delete" size={20} />
                  </button>
                </div>
                {/* Estado de suscripción */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body-sm text-body-sm font-semibold ${
                      vencida
                        ? 'bg-error-container/40 text-error'
                        : 'bg-secondary-container/40 text-on-secondary-container'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${vencida ? 'bg-error' : 'bg-primary'}`}
                    />
                    {s.active === false
                      ? 'Suspendida'
                      : vencida
                        ? 'Suscripción vencida'
                        : diasRestantes !== null
                          ? `Activa · vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`
                          : 'Activa'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => patchStore(s.id, 'renew', s.name)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-semibold active:scale-95"
                      title="Registrar pago y renovar 31 días"
                    >
                      Pago 31 días
                    </button>
                    <button
                      onClick={() => patchStore(s.id, 'toggle', s.name)}
                      className={`px-3 py-1.5 rounded-lg font-body-sm text-body-sm font-semibold active:scale-95 ${
                        s.active === false
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                      title={s.active === false ? 'Activar cuenta' : 'Suspender cuenta'}
                    >
                      {s.active === false ? 'Activar' : 'Suspender'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
