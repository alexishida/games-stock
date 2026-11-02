/**
 * Gera o catálogo RetroArch em C++ a partir da fonte TypeScript compartilhada.
 * Uso: node scripts/native-retroarch-catalog.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src/shared/retroarch.ts');
const target = path.join(projectRoot, 'native/src/db/RetroArchCatalogData.cpp');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gamestock-retroarch-'));

execFileSync(process.execPath, [
  path.join(projectRoot, 'node_modules/typescript/bin/tsc'),
  source,
  '--outDir', temp,
  '--module', 'commonjs',
  '--target', 'es2022',
  '--skipLibCheck',
], { stdio: 'inherit' });

const catalog = require(path.join(temp, 'retroarch.js'));

/** Escapa uma string para literal C++ sem depender do locale do compilador. */
function literal(value) {
  const encoded = Buffer.from(value, 'utf8');
  let output = '';
  for (const byte of encoded) {
    if (byte === 0x22) output += '\\"';
    else if (byte === 0x5c) output += '\\\\';
    else if (byte >= 0x20 && byte < 0x7f) output += String.fromCharCode(byte);
    else output += '\\x' + byte.toString(16).padStart(2, '0') + '""';
  }
  return 'QStringLiteral("' + output + '")';
}

function list(values) {
  return `{${(values ?? []).map(literal).join(', ')}}`;
}

const lines = [];
lines.push('/** Catálogo RetroArch gerado de src/shared/retroarch.ts; não editar à mão. */');
lines.push('// Gerado por scripts/native-retroarch-catalog.cjs.');
lines.push('#include "RetroArchCatalogData.h"');
lines.push('');
lines.push('namespace gamestock::retroarch {');
lines.push('');
lines.push('const QList<CoreEntry>& cores() {');
lines.push('    static const QList<CoreEntry> entries = {');
for (const entry of catalog.RETROARCH_PLATFORM_CORES) {
  lines.push('        CoreEntry{');
  lines.push(`            ${literal(entry.platformName)},`);
  lines.push(`            ${literal(entry.coreName)},`);
  lines.push(`            ${list(entry.aliases)},`);
  lines.push(`            ${list(entry.fallbackCoreNames)},`);
  lines.push(`            ${list(entry.compatibleCoreNamePrefixes)},`);
  lines.push('        },');
}
lines.push('    };');
lines.push('    return entries;');
lines.push('}');
lines.push('');
lines.push('} // namespace gamestock::retroarch');
lines.push('');

fs.writeFileSync(target, lines.join('\n'), 'utf8');
fs.rmSync(temp, { recursive: true, force: true });
console.log(`Plataformas RetroArch geradas: ${catalog.RETROARCH_PLATFORM_CORES.length}.`);
