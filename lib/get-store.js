'use client';

import { createClient } from '@/lib/supabase-browser';

// Contexto del usuario autenticado: su tienda y su id (RLS exige ambos en cada insert)
// Caché en memoria + localStorage: evita 2 requests a Supabase en cada guardado
let cached = null;

const LS_KEY = 'miprenda_ctx';
const LEGACY_KEY = 'pacapos_ctx'; // clave pre-renombre (2026-09): migrar si existe

function readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.storeId && p.userId) return p;
    }
    // Migración desde la clave vieja de PacaPOS
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy);
      localStorage.removeItem(LEGACY_KEY);
      if (p.storeId && p.userId) {
        localStorage.setItem(LS_KEY, JSON.stringify(p));
        return p;
      }
    }
  } catch {}
  return null;
}

export async function getMyContext() {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    const ls = readLS();
    if (ls) {
      cached = ls;
      return cached;
    }
  }
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Tu sesión expiró. Cierra sesión y vuelve a entrar.');
  }

  const { data, error } = await supabase.from('profiles').select('store_id').maybeSingle();
  if (error || !data?.store_id) {
    throw new Error('No se pudo determinar tu tienda. Cierra sesión y vuelve a entrar.');
  }

  cached = { storeId: data.store_id, userId: user.id };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cached));
  } catch {}
  return cached;
}

// Compatibilidad con llamadas antiguas
export async function getStoreId() {
  const ctx = await getMyContext();
  return ctx.storeId;
}

// Invalida caché (al cerrar sesión)
export function clearStoreCache() {
  cached = null;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
