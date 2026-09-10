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
          <span className="material-symbols-outlined text-[48px] text-primary">storefront</span>
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
