'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirect') || '/app/inicio';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos. Verifica tus datos.'
            : 'Error al conectar: ' + error.message
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError('No se pudo conectar al servidor. Revisa tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] px-3.5 py-3 text-[14px] text-on-surface outline-none focus:border-primary';

  return (
    <form onSubmit={handleLogin} className="space-y-2.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
        placeholder="Correo"
        autoComplete="email"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputCls}
        placeholder="Contraseña"
        autoComplete="current-password"
      />
      {error && (
        <p className="text-[12.5px] text-error font-semibold bg-error-container border border-primary-fixed-dim rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-primary text-on-primary text-[14px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60"
      >
        {loading ? 'Entrando…' : 'Entrar a mi tienda'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 max-w-md mx-auto bg-surface">
      <div className="w-full space-y-4">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-14 h-14 rounded-[14px] bg-primary text-on-primary flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M12 2l9 5v10l-9 5-9-5V7z" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-on-surface tracking-tight">PacaPOS</h1>
            <p className="text-[12px] text-on-surface-variant">Entra a tu tienda</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline rounded-[14px] p-4">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-[11.5px] text-on-surface-variant">
          ¿Aún no tienes cuenta? Pídesela al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
