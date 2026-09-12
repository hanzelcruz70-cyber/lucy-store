#!/usr/bin/env node
/* ============================================================
 * PacaPOS · gate de secretos
 * Bloque el commit si el diff staged contiene:
 *  - JWT de Supabase (anon/service/usuario)
 *  - URLs postgres con password embebido
 *  - Contraseñas/keys pegadas en archivos de config
 * Uso: node scripts/check-secrets.cjs   (pre-commit + CI)
 * Sale con código 1 si encuentra algo (bloquea el commit).
 * ============================================================ */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const patterns = [
  {
    name: 'JWT de Supabase',
    regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    hint: 'Parece un JWT de Supabase. Si ya se commiteó: ROTAR las llaves en Supabase (borrar no basta).',
  },
  {
    name: 'URL postgres con password',
    regex: /postgres(ql)?:\/\/[^\s@]+:[^\s@]+@/,
    hint: 'URL de base de datos con contraseña embebida. Va solo en .env.local.',
  },
  {
    name: 'service_role asignado',
    regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][A-Za-z0-9+/_=-]{30,}['"]/,
    hint: 'Llave service_role pegada en código. Va solo en .env.local.',
  },
  {
    name: 'Contraseña admin asignada',
    regex: /ADMIN_(PASSWORD|SECRET)\s*=\s*['"][^'"]{6,}['"]/,
    hint: 'Contraseña/secret del admin pegado en código. Va solo en .env.local.',
  },
];

function stagedDiff() {
  try {
    // En CI no hay staged: se escanea el último commit (--cached vacío)
    const hasStaged =
      execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim().length > 0;
    return hasStaged
      ? execSync('git diff --cached', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      : execSync('git log -1 -p', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return '';
  }
}

// Archivos permitidos que contienen las palabras clave como TEMPLATE (no valores reales)
const allowlist = [/^\.env\.example$/, /check-secrets\.cjs$/];

const diff = stagedDiff();
let leaks = [];
let currentFile = '(desconocido)';

if (diff) {
  // Líneas añadidas: +algo (omite +++)
  const added = diff.split('\n').filter((l) => /^\+(?!\+\+)/.test(l));
  for (const line of added) {
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      continue;
    }
    for (const p of patterns) {
      if (p.regex.test(line)) {
        leaks.push({ file: currentFile || '(desconocido)', line: line.slice(1, 120), name: p.name, hint: p.hint });
        break; // un hallazgo por línea es suficiente
      }
    }
  }
}

// Doble check: .env.local NUNCA debe estar staged
try {
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  if (/^\.env(\.local)?$/.test(stagedFiles.trim())) {
    leaks.push({ file: '.env.local', line: '', name: 'Archivo de secretos staged', hint: 'Nunca commitear .env.local' });
  }
} catch {}

if (leaks.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', `\n✋ COMMIT BLOQUEADO — secretos detectados (${leaks.length}):\n`);
  for (const l of leaks) {
    console.error('\x1b[31m%s\x1b[0m', `  [${l.name}] ${l.file}`);
    if (l.line) console.error(`    ${l.line}`);
    console.error(`    → ${l.hint}\n`);
  }
  console.error('Regla: secreto filtrado = ROTAR en Supabase inmediatamente (borrar del repo no basta).\n');
  process.exit(1);
}
console.log('check-secrets: OK — sin secretos en el diff');
