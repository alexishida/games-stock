/**
 * Script temporario de diagnostico para inspecionar contagens de jogos por plataforma.
 *
 * Usa o runtime do Electron do projeto para abrir o `better-sqlite3` com a ABI
 * correta e imprimir um snapshot do banco local do usuario em modo somente leitura.
 */

const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

/** Resolve caminho padrao do banco SQLite do GameStock no perfil do usuario. */
function getDatabasePath() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "gamestock", "gamestock.db");
}

/** Executa consulta principal e imprime resultados para diagnostico. */
function main() {
  const dbPath = getDatabasePath();
  const db = new Database(dbPath, { readonly: true });

  const platforms = db.prepare(`
    SELECT p.id, p.name, p.category, p.is_default, COUNT(g.id) AS gameCount
    FROM platforms p
    LEFT JOIN games g ON g.platform_id = p.id
    GROUP BY p.id
    ORDER BY LOWER(p.name)
  `).all();

  const platformTitles = db.prepare(`
    SELECT p.id, p.name, COUNT(*) AS totalTitles
    FROM platforms p
    JOIN games g ON g.platform_id = p.id
    GROUP BY p.id, p.name
    ORDER BY totalTitles DESC, LOWER(p.name)
  `).all();

  console.log("DB", dbPath);
  console.log("PLATFORMS");
  for (const row of platforms) console.log(JSON.stringify(row));
  console.log("PLATFORM_TITLES");
  for (const row of platformTitles) console.log(JSON.stringify(row));

  db.close();
}

main();
