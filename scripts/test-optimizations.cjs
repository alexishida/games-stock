/**
 * Regressões de consultas e cache LaunchBox, sem acessar dados reais do usuário.
 * Execute `node scripts/test-optimizations.cjs`; compila o main e usa o ABI do Electron.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// O better-sqlite3 instalado pertence ao Electron, não ao Node do terminal.
if (!process.versions.electron) {
  const root = path.resolve(__dirname, "..");
  const compiled = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.main.json"], {
    cwd: root, stdio: "inherit", windowsHide: true
  });
  if (compiled.error) throw compiled.error;
  if (compiled.status !== 0) process.exit(compiled.status ?? 1);
  const tested = spawnSync(require("electron"), [__filename], {
    cwd: root, stdio: "inherit", windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
  });
  if (tested.error) throw tested.error;
  process.exit(tested.status ?? 1);
}

const { test } = require("node:test");

/** Cria área exclusiva e verifica seu caminho antes da limpeza recursiva. */
function temporaryData(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gamestock-optimization-"));
  const previous = process.env.GAMESTOCK_USER_DATA_DIR;
  process.env.GAMESTOCK_USER_DATA_DIR = directory;
  t.after(() => {
    if (previous === undefined) delete process.env.GAMESTOCK_USER_DATA_DIR;
    else process.env.GAMESTOCK_USER_DATA_DIR = previous;
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("gamestock-optimization-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

/** Recarrega somente o singleton de cache para simular uma nova sessão do app. */
function freshLaunchBox() {
  const target = require.resolve("../dist/main/lib/launchbox/db.js");
  delete require.cache[target];
  return require(target);
}

/** XML mínimo com imagem para validar parsing e preservação dos metadados. */
function metadataXml(name = "Super Mario") {
  return `<LaunchBox><Game><DatabaseID>1</DatabaseID><Name>${name}</Name><Platform>NES</Platform></Game>
    <GameImage><DatabaseID>1</DatabaseID><FileName>cover.png</FileName><Type>Box - Front</Type></GameImage></LaunchBox>`;
}

test("consultas preservam variantes, filtros cruzados, empates e banco populado", (t) => {
  temporaryData(t);
  const { getDatabase, closeDatabase } = require("../dist/main/db/database.js");
  const { GameDao } = require("../dist/main/db/dao/gameDao.js");
  const database = getDatabase();
  try {
    const [p1, p2] = database.prepare("SELECT id FROM platforms ORDER BY id LIMIT 2").all();
    const dao = new GameDao(database);
    assert.deepEqual(dao.sidebarCounts().collections, { favorites: 0, playing: 0, completed: 0, mostPlayed: 0 });
    // Duas variantes do mesmo grupo pertencem a coleções diferentes.
    const first = dao.create({ title: "Mario", platform_id: p1.id, rom_path: "Mario (USA).nes", favorite: true, play_status: "playing", box_art_path: "cover.png", genre: "Action; Platform", year: 1990, notes: "nota preservada" });
    const second = dao.create({ title: "Mario", platform_id: p1.id, rom_path: "Mario (Europe).nes", play_status: "completed", launch_count: 3, year: 1991 });
    const manual = dao.create({ title: "Mario", platform_id: p1.id, favorite: true, year: 1992 });
    dao.create({ title: "Mario", platform_id: p2.id, rom_path: "Mario.nes", play_status: "completed", box_art_path: "other.png" });
    const legacy = dao.create({ title: "Zelda", platform_id: p1.id, rom_path: "Zelda.nes" });
    // Simula registro legado sem chave derivada; deve permanecer visível e independente.
    database.prepare("UPDATE games SET library_group_key = NULL WHERE id = ?").run(legacy.id);
    assert.equal(dao.list().filtered, 4);
    assert.equal(dao.list().total, 4);
    assert.deepEqual(dao.sidebarCounts(), {
      all: 4, collections: { favorites: 2, playing: 1, completed: 2, mostPlayed: 1 },
      platforms: { [p1.id]: 3, [p2.id]: 1 }
    });
    assert.deepEqual(dao.sidebarCounts({ platformId: p1.id, collectionFilter: "completed" }), {
      all: 3, collections: { favorites: 2, playing: 1, completed: 1, mostPlayed: 1 },
      platforms: { [p1.id]: 1, [p2.id]: 1 }
    });
    assert.deepEqual(dao.sidebarCounts({ includeMissingCovers: false }).collections,
      { favorites: 1, playing: 1, completed: 1, mostPlayed: 0 });
    assert.equal(dao.sidebarCounts({ search: "absent" }).all, 0);
    assert.equal(dao.sidebarCounts({ genre: "action" }).all, 1);
    assert.deepEqual(dao.listGenres(), ["Action", "Platform"]);
    assert.equal(dao.list({ collectionFilter: "completed", platformId: p1.id }).items[0].id, second.id);
    assert.equal(dao.list({ collectionFilter: "mostPlayed", platformId: p1.id }).items[0].id, second.id);
    assert.equal(dao.list({ sortBy: "title", platformId: p1.id }).items[0].id, first.id);
    assert.equal(dao.list({ sortBy: "year", platformId: p1.id }).items[0].id, manual.id);
    // Páginas concatenadas devem ser idênticas à consulta inteira, sem perda nem duplicação.
    for (const sortBy of ["title", "year", "recent", "mostPlayed"]) {
      const full = dao.list({ sortBy, pageSize: 100 });
      const paged = Array.from({ length: full.filtered }, (_, i) => dao.list({ sortBy, pageSize: 1, page: i + 1 }).items[0]);
      assert.deepEqual(paged, full.items);
    }
    const before = database.prepare("SELECT * FROM games ORDER BY id").all();
    closeDatabase();
    assert.deepEqual(getDatabase().prepare("SELECT * FROM games ORDER BY id").all(), before);
  } finally {
    closeDatabase();
  }
});

test("LaunchBox compartilha workers, reaproveita cache e repara JSON corrompido", async (t) => {
  const directory = temporaryData(t);
  const cache = path.join(directory, "launchbox_cache");
  fs.mkdirSync(cache);
  const xml = path.join(cache, "Metadata.xml");
  const json = path.join(cache, "index.json");
  fs.writeFileSync(xml, metadataXml());
  const api = freshLaunchBox();
  let firstProgress = 0;
  let secondProgress = 0;
  const [first, second] = await Promise.all([
    api.buildIndex(() => firstProgress++), api.buildIndex(() => secondProgress++)
  ]);
  assert.strictEqual(first, second);
  assert.equal(firstProgress, 1);
  assert.equal(secondProgress, 1);
  assert.equal(first["1"].name, "Super Mario");
  assert.equal(first["1"].images[0].filename, "cover.png");
  assert.strictEqual(await api.buildIndex(), first);

  // XML inválido e mais antigo prova que a sessão seguinte reutiliza o JSON válido.
  fs.writeFileSync(xml, "<broken>");
  fs.utimesSync(xml, new Date(0), new Date(0));
  assert.deepEqual(await freshLaunchBox().buildIndex(), first);

  fs.writeFileSync(xml, metadataXml("Rebuilt"));
  fs.writeFileSync(json, '{"partial":');
  assert.equal((await freshLaunchBox().buildIndex())["1"].name, "Rebuilt");

  // Falha de parsing deve rejeitar e permitir nova tentativa, sem promise presa.
  fs.writeFileSync(xml, "<broken>");
  fs.writeFileSync(json, "invalid");
  const failing = freshLaunchBox();
  await assert.rejects(failing.buildIndex());
  fs.writeFileSync(xml, metadataXml("Recovered"));
  assert.equal((await failing.buildIndex())["1"].name, "Recovered");
});

test("download concorrente é único e atualização aguarda indexação ativa", async (t) => {
  const directory = temporaryData(t);
  const cache = path.join(directory, "launchbox_cache");
  fs.mkdirSync(cache);
  fs.writeFileSync(path.join(cache, "Metadata.xml"), metadataXml("Old"));
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();
  zip.addFile("Metadata.xml", Buffer.from(metadataXml("New")));
  let requests = 0;
  const originalFetch = global.fetch;
  // Substitui apenas transporte: extração, arquivos e workers permanecem reais.
  global.fetch = async () => {
    requests++;
    return new Response(zip.toBuffer(), { status: 200 });
  };
  try {
    const api = freshLaunchBox();
    const readingOld = api.buildIndex();
    const downloading = api.ensureMetadata(true);
    const duplicate = api.ensureMetadata(true);
    const readingNew = api.buildIndex();
    assert.equal((await readingOld)["1"].name, "Old");
    await Promise.all([downloading, duplicate]);
    assert.equal(requests, 1);
    assert.equal((await readingNew)["1"].name, "New");

    // Falha de rede não deve envenenar a operação compartilhada nem apagar cache existente.
    global.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(api.ensureMetadata(true), /offline/);
    assert.equal((await api.buildIndex())["1"].name, "New");
    global.fetch = async () => new Response(zip.toBuffer(), { status: 200 });
    assert.equal((await api.ensureMetadata(true)).status, "downloaded");
  } finally {
    global.fetch = originalFetch;
  }
});
