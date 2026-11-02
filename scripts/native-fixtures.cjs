/**
 * Gera perfis e backups sintéticos pelo runtime Electron, preservando seu ABI.
 * Não acessa perfis reais, não faz downloads e nunca remove artefatos anteriores.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

/** Raiz fixa mantém todos os artefatos de teste dentro do workspace. */
const root = path.resolve(__dirname, '..');

/** Usa o backend Electron congelado em tools/legacy-runtime, sem recompilar o runtime removido. */
function launchReference() {
  const executed = spawnSync(require('electron'), [__filename], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', GAMESTOCK_FIXTURE_NODE: process.execPath }
  });
  if (executed.error) throw executed.error;
  assert.equal(executed.status, 0, 'Falha na validação das fixtures.');
}

/** Valida leitura, reabertura, emulador falso e restauração das cinco categorias. */
function generate() {
  const artifactRoot = path.join(root, 'artifacts/native-migration');
  fs.mkdirSync(artifactRoot, { recursive: true });
  const run = fs.mkdtempSync(path.join(artifactRoot, 'fixtures-'));
  const source = path.join(run, 'legacy-populated');
  const fixtures = require('../tools/legacy-runtime/dist/main/db/fixtures/migrationFixture.js');
  const database = require('../tools/legacy-runtime/dist/main/db/database.js');
  const { GameDao } = require('../tools/legacy-runtime/dist/main/db/dao/gameDao.js');
  const { AppStateDao } = require('../tools/legacy-runtime/dist/main/db/dao/appStateDao.js');
  const backup = require('../tools/legacy-runtime/dist/main/dataPortability.js');
  const categories = ['metadata', 'images', 'platforms', 'romLocations', 'inventoryImages'];
  // Registrar limitações da referência é diferente de certificar paridade de dados do futuro runtime.
  const observations = [];
  try {
    fixtures.createLegacyFixture(source);
    fs.copyFileSync(path.join(source, 'gamestock.db'), path.join(run, 'legacy-before-migrations.db'));
    fixtures.selectMigrationFixture(source);
    const original = new GameDao(database.getDatabase()).get(fixtures.MIGRATION_FIXTURE_IDS.game);
    assert.equal(original.notes, 'Anotação preservada: ação e coleção');
    assert.equal(original.launch_count, 7);
    fixtures.populateMigrationFixture(source, process.env.GAMESTOCK_FIXTURE_NODE);
    const before = fixtures.migrationFixtureSnapshot();
    assert.equal(before.integrity, 'ok');
    assert.deepEqual(before.foreignKeyErrors, []);
    database.closeDatabase();
    assert.deepEqual(fixtures.migrationFixtureSnapshot(), before, 'Reabertura alterou dados estáveis.');
    // O catálogo é uma entrada somente de leitura para o protótipo QML, sem abrir SQLite nele.
    const catalog = new GameDao(database.getDatabase()).list({ pageSize: 1000 }).items.map((game) => ({ ...game, coverUrl: game.box_art_path ? require('node:url').pathToFileURL(game.box_art_path).href : '' }));
    fs.writeFileSync(path.join(run, 'catalog.json'), JSON.stringify(catalog, null, 2));
    const fake = spawnSync(process.env.GAMESTOCK_FIXTURE_NODE, [path.join(source, 'fake-emulator.cjs'), 'ROM com ação.nes'], { windowsHide: true });
    assert.equal(fake.status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(source, 'emulator-invocation.json'), 'utf8')), ['ROM com ação.nes']);
    const folderEntries = new AppStateDao(database.getDatabase()).get('gamestock.romImport.folderEntries');
    for (const selected of [...categories.map((category) => [category]), categories]) {
      fixtures.selectMigrationFixture(source);
      const targetPath = path.join(run, `${selected.length === 1 ? selected[0] : 'complete'}.gamestock-backup`);
      const result = backup.exportDataPackage({ categories: selected, targetPath, romFolderEntries: folderEntries, appVersion: '1.1.4-fixture' });
      assert.equal(result.canceled, false);
      assert.equal(result.manifest.schemaVersion, 1);
      const target = path.join(run, `restored-${selected.join('-')}`);
      fixtures.selectMigrationFixture(target);
      const preview = backup.previewImportPackage(targetPath);
      assert.deepEqual(preview.errors, []);
      backup.importDataPackage({ packagePath: targetPath, categories: selected });
      const restored = fixtures.migrationFixtureSnapshot();
      assert.equal(restored.integrity, 'ok');
      assert.deepEqual(restored.foreignKeyErrors, []);
      if (selected.includes('metadata')) {
        const game = restored.games.find((entry) => entry.title === 'Jogo sem capa');
        assert.ok(game, 'Metadados básicos não restaurados.');
        assert.equal(game.notes, 'Sem mídia é um estado válido');
        // O Electron atual omite launch_count do backup e pode colapsar variantes sem rom_path.
        // Manter a evidência permite corrigir o contrato sem mascarar a perda na migração Qt.
        observations.push({ categories: selected, sourceGameCount: before.games.length, restoredGames: restored.games, preservesVariantCount: restored.games.length === before.games.length, preservesLaunchCount: restored.games.some((entry) => entry.launch_count === 7) });
      }
      if (selected.includes('inventoryImages')) {
        assert.equal(restored.hardware.length, 2);
        assert.equal(restored.photos.length, 1);
        assert.ok(restored.photos[0].file_path.startsWith(target));
        assert.ok(fs.existsSync(restored.photos[0].file_path));
      }
      if (selected.includes('images')) {
        assert.ok(fs.existsSync(path.join(target, 'images', 'fixture', 'cover.png')));
      }
    }
    fs.writeFileSync(path.join(run, 'verification.json'), JSON.stringify({ runtime: process.versions, categories, checks: ['legacy-migration', 'idempotent-reopen', 'integrity', 'foreign-keys', 'fake-emulator', 'six-basic-backup-roundtrips'], observations, sourceSnapshot: before }, null, 2));
    console.log(`Fixtures e seis restaurações básicas verificadas: ${run}`);
    console.log('Limitações observadas do backup Electron: launch_count ausente e variantes sem paths podem colapsar. Ver verification.json; paridade de dados ainda não certificada.');
  } finally {
    database.closeDatabase();
  }
}

if (process.versions.electron) generate();
else launchReference();

