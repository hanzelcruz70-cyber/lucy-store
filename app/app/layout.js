import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AppShell from '@/components/AppShell';
import LogoutButton from '@/components/LogoutButton';

export default async function AppLayout({ children }) {
  const supabase = createClient();
  // getSession lee la cookie local (sin viaje a Supabase en cada navegación).
  // La validez del token la respalda el RLS en cada query y el middleware en el edge.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user || null;
  if (!user) redirect('/login');

  // Reintento de cortesía: un fallo transitorio de red (Supabase flaky) no
  // debe mostrar "Cuenta sin tienda" de inmediato — el cliente no existe aún
  // o la red falló una vez. Reintentamos una vez antes de renderizar el error.
  let profile = null;
  let profileError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, display_name, store_id, stores(name, active, paid_until, blocked_reason)')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;
    profileError = error;
    if (!error) break;
    // Pausa exponencial corta antes de reintentar
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  // Error de red: NO dejamos al usuario colgado en una pantalla de "sin cuenta"
  // (eso causó expulsiones falsas). En su lugar, mensaje claro con reintento.
  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-gutter-mobile max-w-md mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg text-center space-y-space-sm w-full">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M2 2l20 20" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M5 12.5a10 10 0 0 1 3-2" />
            <path d="M12 20h.01" />
          </svg>
          <h1 className="font-headline-md text-headline-md text-on-surface">Sin conexión estable</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            No pudimos cargar tu tienda. Revisa tu internet y reintenta — si el problema
            persiste, contacta al administrador.
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  if (!profile?.store_id) {
    return (
      <div className="min-h-screen flex items-center justify-center px-gutter-mobile max-w-md mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg text-center space-y-space-sm w-full">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M4 10.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5" />
            <path d="M3.5 6.5L5 3h14l1.5 3.5" />
            <path d="M3.5 6.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5" />
            <path d="M9.75 21v-5.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V21" />
          </svg>
          <h1 className="font-headline-md text-headline-md text-on-surface">Cuenta sin tienda</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Tu cuenta aún no está vinculada a una tienda. Contacta al administrador del sistema.
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  // Suscripción: cuenta desactivada por el admin o pago vencido
  const store = profile.stores || {};
  const vencidaSuscripcion =
    store.active === false ||
    (store.paid_until && new Date(store.paid_until) <= new Date());
  if (vencidaSuscripcion) {
    const razon = store.active === false
      ? store.blocked_reason || 'Cuenta suspendida por el administrador'
      : 'Tu suscripción mensual ha vencido';
    return (
      <div className="min-h-screen flex items-center justify-center px-gutter-mobile max-w-md mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg text-center space-y-space-sm w-full">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 13V9M9 2.5h6" />
          </svg>
          <h1 className="font-headline-md text-headline-md text-on-surface">Suscripción pausada</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {razon}. Realiza tu pago para continuar usando Mi Prenda en tu tienda.{' '}
            {store.paid_until && store.active !== false && (
              <span className="block mt-2 font-body-sm text-body-sm">
                Venció el {new Date(store.paid_until).toLocaleDateString('es-NI')}
              </span>
            )}
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      storeName={profile.stores?.name || 'Mi Tienda'}
      userName={profile.display_name || user.email}
    >
      {children}
    </AppShell>
  );
}
