import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AppShell from '@/components/AppShell';
import LogoutButton from '@/components/LogoutButton';

export default async function AppLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, store_id, stores(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.store_id) {
    return (
      <div className="min-h-screen flex items-center justify-center px-gutter-mobile max-w-md mx-auto">
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-lg text-center space-y-space-sm w-full">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 20V9M9.5 21.5v-6h5v6" />
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

  return (
    <AppShell
      storeName={profile.stores?.name || 'Mi Tienda'}
      userName={profile.display_name || user.email}
    >
      {children}
    </AppShell>
  );
}
