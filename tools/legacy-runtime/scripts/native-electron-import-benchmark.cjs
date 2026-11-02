/**
 * Mede a importação de ROMs no runtime Electron usando a ABI do próprio Electron.
 * Usa cópia sintética e Metadata.xml local; nunca acessa o perfil real nem a rede.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'artifacts/native-migration/fixtures-H6UzzV/legacy-populated');

/** Cria um Metadata.xml mínimo e recente para impedir download no benchmark. */
function seedMetadata(profile) {
  const cache = path.join(profile, 'launchbox_cache');
  fs.mkdirSync(cache, { recursive: true });
  const file = path.join(cache, 'Metadata.xml');
  fs.writeFileSync(file, '<?xml version="1.0"?><LaunchBox></LaunchBox>');
  const now = new Date();
  fs.utimesSync(file, now, now);
}

/** Executa a importação e imprime o tempo total em ms. */
async function runInElectron() {
  const total = Number(process.env.GAMESTOCK_IMPORT_TOTAL || 1200);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gamestock-import-electron-'));
  fs.copyFileSync(path.join(fixture, 'gamestock.db'), path.join(profile, 'gamestock.db'));
  seedMetadata(profile);
  process.env.GAMESTOCK_USER_DATA_DIR = profile;
  const folder = path.join(profile, 'roms');
  fs.mkdirSync(folder, { recursive: true });
  for (let index = 0; index < total; index += 1) {
    fs.writeFileSync(path.join(folder, `Game ${String(index).padStart(4, '0')} (USA).nes`), 'rom');
  }
  const database = require(path.join(root, 'tools/legacy-runtime/dist/main/db/database.js'));
  const importer = require(path.join(root, 'tools/legacy-runtime/dist/main/romFolderImport.js'));
  const request = { folderPaths: [folder], detectionMode: 'automatic', includeSubfolders: false };
  const started = process.hrtime.bigint();
  const scan = importer.scanRomFolder(request);
  await importer.importRomFolder(request, undefined, scan);
  const importMs = Number(process.hrtime.bigint() - started) / 1e6;
  database.closeDatabase();
  process.stdout.write(JSON.stringify({ importMs, total, scanned: scan.candidates.length }) + '\n');
  fs.rmSync(profile, { recursive: true, force: true });
}

if (process.versions.electron) {
  runInElectron().catch((error) => {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  });
} else {
  const executed = spawnSync(require('electron'), [__filename], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  if (executed.error) throw executed.error;
  process.exitCode = executed.status ?? 1;
}

