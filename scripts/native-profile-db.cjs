/**
 * Prepara uma cópia de banco sintético para capturas da matriz de paridade.
 * O modo "clean" remove jobs e preferências persistidas para reproduzir a tela inicial.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/** Copia a fixture e aplica o saneamento pedido sem abrir o perfil real. */
function main() {
  const [source, target, mode = 'clean'] = process.argv.slice(2);
  if (!source || !target) throw new Error('Uso: node scripts/native-profile-db.cjs <origem> <destino> [clean|jobs]');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  const db = new DatabaseSync(target);
  try {
    if (mode === 'clean') {
      db.prepare("delete from app_state where key like '%job%' or key like '%ui.libraryFilters%'").run();
    }
  } finally {
    db.close();
  }
}

main();
