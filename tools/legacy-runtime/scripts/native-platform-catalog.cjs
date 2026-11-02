/**
 * Gera o catálogo de plataformas em C++ a partir da fonte TypeScript do renderer.
 * O catálogo define a ordem de inserção e, portanto, os IDs das plataformas no SQLite.
 * Uso: node scripts/native-platform-catalog.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src/main/db/platformCatalog.ts');
const target = path.join(projectRoot, 'native/src/db/PlatformCatalogData.cpp');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gamestock-catalog-'));

execFileSync(process.execPath, [
  path.join(projectRoot, 'node_modules/typescript/bin/tsc'),
  source,
  '--outDir', temp,
  '--module', 'commonjs',
  '--target', 'es2022',
  '--skipLibCheck',
], { stdio: 'inherit' });

const catalog = require(path.join(temp, 'platformCatalog.js'));

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

const lines = [];
lines.push('/** Catálogo de plataformas gerado de src/main/db/platformCatalog.ts; não editar à mão. */');
lines.push('// Gerado por scripts/native-platform-catalog.cjs. A ordem preserva os IDs do Electron.');
lines.push('#include "PlatformCatalogData.h"');
lines.push('');
lines.push('namespace gamestock::catalog {');
lines.push('');
lines.push('const QList<PlatformEntry>& platforms() {');
lines.push('    static const QList<PlatformEntry> entries = {');
for (const entry of catalog.PLATFORM_CATALOG) {
  lines.push('        PlatformEntry{');
  lines.push(`            ${literal(entry.name)},`);
  lines.push(`            ${literal(entry.category)},`);
  lines.push(`            {${entry.launchboxAliases.map(literal).join(', ')}},`);
  lines.push('            {');
  for (const extension of entry.romExtensions) {
    lines.push(`                RomExtension{${literal(extension.extension)}, ${literal(extension.kind)}, ${extension.isPrimary ? 'true' : 'false'}},`);
  }
  lines.push('            },');
  lines.push('        },');
}
lines.push('    };');
lines.push('    return entries;');
lines.push('}');
lines.push('');
lines.push('const QList<QPair<QString, QString>>& legacyAliases() {');
lines.push('    static const QList<QPair<QString, QString>> aliases = {');
for (const [legacy, canonical] of catalog.LEGACY_PLATFORM_ALIASES) {
  lines.push(`        {${literal(legacy)}, ${literal(canonical)}},`);
}
lines.push('    };');
lines.push('    return aliases;');
lines.push('}');
lines.push('');
lines.push('} // namespace gamestock::catalog');
lines.push('');

fs.writeFileSync(target, lines.join('\n'), 'utf8');
fs.rmSync(temp, { recursive: true, force: true });
console.log(`Plataformas geradas: ${catalog.PLATFORM_CATALOG.length}; aliases legados: ${catalog.LEGACY_PLATFORM_ALIASES.length}.`);
