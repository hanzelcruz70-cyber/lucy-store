#!/usr/bin/env node
/* Instala el hook pre-commit que bloquea commits con secretos.
 * Uso: node scripts/install-hooks.cjs  (ejecutar una vez tras clonar) */
const fs = require('fs');
const path = require('path');

const hookPath = path.join(__dirname, '..', '.git', 'hooks', 'pre-commit');
const hook = `#!/bin/sh
# PacaPOS pre-commit: bloquea secretos
node scripts/check-secrets.cjs
`;

fs.writeFileSync(hookPath, hook);
fs.chmodSync(hookPath, 0o755);
console.log('pre-commit hook instalado');
