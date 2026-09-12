'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const Icon = ({ name, size = 18 }) => {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C4 8 2.5 12 2.5 12s3.5 7 9.5 7c1.6 0 3-.3 4.2-.9" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      </>
    ),
    store: (
      <>
        <path d="M4 10.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5" />
        <path d="M3.5 6.5L5 3h14l1.5 3.5" />
        <path d="M3.5 6.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.6 2.5s2.6-1.1 2.6-2.5" />
        <path d="M9.75 21v-5.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V21" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirect') || '/app/inicio';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
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

  const fieldWrap = 'relative';
  const inputCls =
    'w-full bg-surface-container-lowest border border-outline rounded-[10px] pl-9 pr-4 py-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors';

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className={fieldWrap}>
        <label className="block text-[12px] font-semibold text-on-surface-variant mb-1.5">
          Correo
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
            <Icon name="mail" />
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="tu@tienda.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div className={fieldWrap}>
        <label className="block text-[12px] font-semibold text-on-surface-variant mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
            <Icon name="lock" />
          </span>
          <input
            type={showPass ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-10`}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1"
          >
            <Icon name={showPass ? 'eyeOff' : 'eye'} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 text-[12.5px] text-error font-semibold bg-error-container border border-primary-fixed-dim rounded-[10px] px-3 py-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-primary text-on-primary text-[14px] font-semibold active:bg-primary-deep transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
            Entrando…
          </>
        ) : (
          'Entrar a mi tienda'
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-5 py-12 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-fixed via-surface to-surface" />
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-fixed-dim/70" />
      <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-primary-fixed/80" />

      <div className="relative w-full max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Link href="/" className="w-16 h-16 rounded-[18px] bg-primary text-on-primary flex items-center justify-center">
            <Icon name="store" size={32} />
          </Link>
          <div>
            <h1 className="text-[26px] font-bold text-on-surface tracking-tight leading-none">
              PacaPOS
            </h1>
            <p className="text-[13px] text-on-surface-variant mt-1">
              Caja, fiados, inventario y Lives. Todo en tu bolsillo.
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline rounded-[16px] p-5">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <div className="text-center space-y-2">
          <p className="text-[12px] text-on-surface-variant">
            ¿Aún no tienes cuenta? Pídesela al administrador del sistema.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-deep transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}