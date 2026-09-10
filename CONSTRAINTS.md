# Constraints

Last reviewed: 2026-09-10 by @hanzelcruz70-cyber

> Contrato de calidad de PacaPOS. Todo agente (IA o humano) debe leerlo antes
> de escribir código. Este archivo no se debilita para que un cambio pase.

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `eslint-disable`, `// noqa`
- No unimplemented stubs: `throw new Error("Not implemented")`, empty `catch {}`
- No secrets in source (las llaves viven solo en `.env.local`, gitignored)
- TODO insert de cliente manda `store_id` + `user_id` vía `getMyContext()` (clients/products: solo `store_id`)
- Moneda SIEMPRE `C$` + `toLocaleString('es-NI')` con función `money()`
- Archivos SIEMPRE UTF-8 sin BOM (PowerShell `Set-Content` corrompe tildes)
- Server components (`page.js`) consultan; client components (`*Client.js`) interactúan; páginas protegidas con `export const dynamic = 'force-dynamic'`
- This file does not get weakened to make a change pass

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Build | `next build` sin errores | `npm run build` | cada tarea, CI |
| Secrets | No secrets en commits | `gitleaks detect --redact --no-banner` | cada tarea, CI |
| Security: deps | 0 vulns runtime (high+) | `npm audit --omit=dev` | CI |

Every row names the command that produces the verdict. A dimension with a
number and no command in this column is an aspiration, not a constraint.

## Measured, not yet enforced

| Metric | Today | Direction |
|--------|-------|-----------|
| Bundle First Load JS (shared) | 103 kB | must not grow >10% |
| Vulns dev/build-time (sharp, postcss internos de Next) | 1 moderate, 1 high | must not grow |
| Tiempo de guardado cliente-side (insert Supabase) | ~1.2s | must not grow |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| W1 | deps: 0 high | `next@15.5.25` (sharp/postcss anidados) | Vulnerables solo en build-time, nunca en runtime. Fix requiere Next 16 (breaking). | @hanzelcruz70-cyber | 2026-12-10 |

## QA gate (antes de cada deploy)

1. `npm run build` verde
2. Flujo probado como usuario real (login → venta → fiado → abono → cierre)
3. Números verificados manualmente (contado/fiado/abonos cuadran)
4. `gitleaks detect --redact` sin hallazgos

## Prácticas del pack agent-skills adoptadas

- **Commits atómicos** (~100 líneas, qué+cómo en el mensaje) — git-workflow-and-versioning
- **Doubt-driven** en cambios de dinero: verificar contra BD, no confiar en la UI — doubt-driven-development
- **Mini-auditoría QA** con subagente usuario-real antes de deploy — code-review-and-quality
- **Spec antes de código** para features grandes — spec-driven-development
