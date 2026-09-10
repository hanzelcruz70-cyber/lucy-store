import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Rate limit en memoria: 8 intentos fallidos por ventana de 15 min
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.ts > WINDOW) {
    attempts.set(ip, { ts: now, count: 0 });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function registerFail(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { ts: now, count: 0 };
  if (now - rec.ts > WINDOW) {
    rec.ts = now;
    rec.count = 0;
  }
  rec.count++;
  attempts.set(ip, rec);
}

// Comparación en tiempo constante (evita timing attacks en la contraseña del admin)
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  const adminPass = process.env.ADMIN_PASSWORD;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminPass || !adminSecret) return false;
  return safeEqual(token, adminPass) || safeEqual(token, adminSecret);
}

function guard(request) {
  const ip = getIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429 }
    );
  }
  if (!checkAdmin(request)) {
    registerFail(ip);
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return null; // autorizado
}

function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'tienda'
  );
}

// GET: listar tiendas con su dueño
export async function GET(request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createSupabaseClient(url, key, { auth: { persistSession: false } });

  const { data: stores, error } = await admin
    .from('stores')
    .select('id, name, slug, owner_email, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, store_id')
    .order('created_at', { ascending: false });

  return NextResponse.json({
    stores: stores || [],
    profiles: profiles || [],
  });
}

// POST: crear usuario + tienda + perfil (flujo admin)
export async function POST(request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const ownerName = String(body.ownerName || '').trim();
    const storeName = String(body.storeName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!ownerName || !storeName || !email || password.length < 8) {
      return NextResponse.json(
        { error: 'Faltan datos o la contraseña es menor a 8 caracteres' },
        { status: 400 }
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 });
    }
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false } });

    // 1) Crear usuario en Auth (sin confirmación de email: el admin ya lo valida)
    const { data: userData, error: errUser } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: ownerName },
    });
    if (errUser) {
      const msg =
        errUser.message === 'User already registered'
          ? 'Ese correo ya tiene cuenta'
          : errUser.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const userId = userData.user.id;

    // 2) Crear la tienda con el nombre EXACTO dado por el admin
    const { data: store, error: errStore } = await admin
      .from('stores')
      .insert({
        name: storeName,
        slug: `${slugify(storeName)}-${Math.random().toString(36).slice(2, 6)}`,
        owner_email: email,
      })
      .select('id')
      .single();
    if (errStore) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Error creando tienda: ' + errStore.message }, { status: 500 });
    }

    // 3) Vincular perfil
    const { error: errProfile } = await admin.from('profiles').upsert({
      id: userId,
      store_id: store.id,
      role: 'owner',
      display_name: ownerName,
    });
    if (errProfile) {
      await admin.from('stores').delete().eq('id', store.id);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Error creando perfil: ' + errProfile.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      store: { id: store.id, name: storeName },
      owner: { id: userId, email },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: eliminar tienda y su dueño por id de usuario
export async function DELETE(request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false } });

    const { data: profile } = await admin.from('profiles').select('store_id').eq('id', userId).maybeSingle();
    if (profile?.store_id) {
      await admin.from('stores').delete().eq('id', profile.store_id);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
