/** Importa no Electron um pacote exportado pelo Qt e confere o banco resultante. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

/** Aguarda o renderer empacotado expor o DevTools. */
async function waitForPage(port, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Electron terminou antes da importação: ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((item) => item.type === 'page' && item.url.includes('electron-release/') && item.url.includes('app.asar/') && item.url.includes('index.html'));
      if (page) return page;
    } catch { /* porta ainda não pronta */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Tempo esgotado aguardando renderer Electron.');
}

/** Cliente CDP mínimo, equivalente ao usado nas capturas de referência. */
async function connectDebugger(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Tempo esgotado conectando ao DevTools.')); }, 10000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('Falha ao conectar ao DevTools.')); };
  });
  let nextId = 0;
  const pending = new Map();
  socket.onclose = () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error('Conexão DevTools encerrada antes da resposta.'));
    }
    pending.clear();
  };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  };
  return {
    socket,
    command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Tempo esgotado no comando DevTools: ${method}`)); }, 120000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

/** Avalia uma expressão no renderer e devolve o valor serializável. */
async function evaluate(client, expression) {
  const result = await client.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Falha ao avaliar no renderer.');
  }
  return result.result.value;
}

async function main() {
  const packagePath = path.resolve(process.argv[2] || '');
  if (!fs.existsSync(packagePath)) throw new Error('Informe o pacote .gamestock-backup exportado pelo Qt.');
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'artifacts', 'native-migration');
  const exe = path.join(artifacts, 'electron-release', 'win-unpacked', 'GameStock.exe');
  if (!fs.existsSync(exe)) throw new Error('Build Electron empacotada ausente em artifacts/native-migration/electron-release.');

  const output = fs.mkdtempSync(path.join(artifacts, 'backup-compat-'));
  const profile = path.join(output, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const port = 40000 + Math.floor(Math.random() * 20000);
  const child = spawn(exe, [`--remote-debugging-port=${port}`, '--remote-allow-origins=*'], {
    windowsHide: true,
    env: { ...process.env, GAMESTOCK_USER_DATA_DIR: profile, PORTABLE_EXECUTABLE_DIR: output },
    stdio: 'ignore'
  });
  let client;
  try {
    const page = await waitForPage(port, child);
    client = await connectDebugger(page.webSocketDebuggerUrl);
    await client.command('Page.enable');
    // Deixa o bootstrap criar/migrar o perfil antes de chamar a portabilidade.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const categories = ['metadata', 'images', 'platforms', 'romLocations', 'inventoryImages'];
    const preview = await evaluate(client, `window.gameStockAPI.dataPortability.previewImport(${JSON.stringify(packagePath)})`);
    if (preview.errors && preview.errors.length) throw new Error(`Preview Electron recusou o pacote: ${preview.errors.map((item) => item.message).join('; ')}`);
    const job = await evaluate(client, `(async () => {
      const started = await window.gameStockAPI.dataPortability.importPackage({ packagePath: ${JSON.stringify(packagePath)}, categories: ${JSON.stringify(categories)} });
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        const jobs = await window.gameStockAPI.dataPortability.jobs();
        const current = jobs.find((entry) => entry.jobId === started.jobId);
        if (current && current.status !== 'running') return current;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error('Tempo esgotado aguardando job de importação.');
    })()`);
    if (job.status !== 'completed') throw new Error(`Job Electron falhou: ${job.error || job.status}`);
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const databasePath = path.join(profile, 'gamestock.db');
    const database = new DatabaseSync(databasePath);
    const gameCount = database.prepare('SELECT COUNT(*) AS count FROM games').get().count;
    const itemCount = database.prepare('SELECT COUNT(*) AS count FROM hardware_items').get().count;
    const photoCount = database.prepare('SELECT COUNT(*) AS count FROM hardware_item_photos').get().count;
    const game = database.prepare('SELECT title, box_art_path, rom_path FROM games ORDER BY id LIMIT 1').get();
    database.close();
    const result = {
      success: true,
      packagePath,
      profile,
      electronVersion: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version,
      preview: { counts: preview.counts, conflicts: preview.conflicts, warnings: preview.warnings.length },
      import: { status: job.status, summary: job.importResult?.summary },
      database: { games: gameCount, inventoryItems: itemCount, inventoryPhotos: photoCount, firstGame: game },
      mediaExists: Boolean(game?.box_art_path && fs.existsSync(game.box_art_path))
    };
    fs.writeFileSync(path.join(output, 'compat-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (gameCount < 1 || itemCount < 1 || photoCount < 1 || !result.mediaExists) throw new Error('Importação Electron não restaurou todas as entidades/mídias.');
  } finally {
    if (client) client.socket.close();
    if (child.exitCode === null) child.kill();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
