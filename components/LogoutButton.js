'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function LogoutButton({ label = 'Cerrar sesión y volver al login' }) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      className="w-full min-h-[52px] bg-primary text-on-primary rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
    >
      <span className="material-symbols-outlined text-[22px]">logout</span>
      {label}
    </button>
  );
}
