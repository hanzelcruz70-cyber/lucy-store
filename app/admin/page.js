'use client';

import { useEffect, useState } from 'react';

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
              <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md text-on-surface">Panel Admin</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">PacaPOS · Solo el dueño del sistema</p>
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
              <span className="material-symbols-outlined text-[22px]">lock_open</span>
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
            <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
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
          <span className="material-symbols-outlined text-primary text-[22px]">add_business</span>
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
            <span className="material-symbols-outlined text-[22px]">person_add</span>
            {busy ? 'Creando...' : 'Crear tienda y cuenta'}
          </button>
        </form>
      </div>

      {/* Listado de tiendas */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg space-y-space-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">storefront</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Tiendas del sistema</h2>
        </div>
        {stores.length === 0 && (
          <p className="font-body-md text-body-md text-on-surface-variant">Aún no hay tiendas creadas.</p>
        )}
        <div className="space-y-space-xs">
          {stores.map((s) => {
            const profile = profiles.find((p) => p.store_id === s.id);
            const owner = profile ? `${profile.display_name} · ${s.owner_email}` : s.owner_email;
            return (
              <div key={s.id} className="bg-surface-container-low rounded-xl p-space-sm flex items-center justify-between gap-space-sm">
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
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
