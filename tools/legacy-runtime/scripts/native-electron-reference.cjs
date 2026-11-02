/** Captura uma referência Electron de produção em cópia isolada de fixture sintética. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

/** Impede o bootstrap automático de baixar metadados reais durante capturas sintéticas. */
function seedReferenceMetadata(profile) {
  const directory = path.join(profile, 'launchbox_cache');
  const metadata = path.join(directory, 'Metadata.xml');
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(metadata)) {
    fs.writeFileSync(metadata, '<?xml version="1.0" encoding="UTF-8"?><LaunchBox><Game><DatabaseID>fixture-1</DatabaseID><Name>Jogo sintético</Name><Platform>Fixture Console</Platform></Game></LaunchBox>');
  }
}

/** Reaponta somente as mídias da cópia para a raiz sintética equivalente. */
function relocateFixtureMedia(databasePath, source, destination) {
  const database = new DatabaseSync(databasePath);
  try {
    const rows = database.prepare('SELECT id, box_art_path, background_path, screenshot_path FROM games').all();
    const update = database.prepare('UPDATE games SET box_art_path = ?, background_path = ?, screenshot_path = ? WHERE id = ?');
    const root = path.resolve(source);
    /** Preserva referências externas e regrava somente arquivos contidos na fixture original. */
    function relocated(value) {
      if (!value) return value;
      const relative = path.relative(root, path.resolve(value));
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? path.join(destination, relative) : value;
    }
    database.exec('BEGIN');
    try {
      for (const row of rows) update.run(relocated(row.box_art_path), relocated(row.background_path), relocated(row.screenshot_path), row.id);
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  } finally { database.close(); }
}

/** Acrescenta jogos sintéticos agrupados em pares apenas ao banco temporário. */
function populateBenchmark(databasePath, count) {
  const database = new DatabaseSync(databasePath);
  try {
    const platform = database.prepare('SELECT platform_id FROM games ORDER BY id LIMIT 1').get();
    if (!platform) throw new Error('A fixture precisa conter pelo menos um jogo.');
    const insert = database.prepare("INSERT INTO games (title, platform_id, genre, rom_path, favorite, play_status, launch_count, library_group_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    database.exec('BEGIN');
    try {
      for (let index = 0; index < count; index += 1) {
        const group = String(Math.floor(index / 2)).padStart(6, '0');
        const genre = index < 2 ? 'ΟΣ; İ; Ação' : index % 2 ? 'Ação; Plataforma' : 'Ação';
        insert.run(`Jogo sintético ${group}`, platform.platform_id, genre, `C:/fixtures/${group}-${index % 2}.rom`, index % 3 === 0 ? 1 : 0, 'unplayed', index % 7, `jogo sintetico ${group}`);
      }
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  } finally { database.close(); }
}

/** Aguarda o processo disponibilizar o DevTools local, sem alcançar dados reais do usuário. */
async function waitForPage(port, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Electron terminou antes da captura: ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((item) => item.type === 'page' && item.url.includes('electron-release/') && item.url.includes('app.asar/') && item.url.includes('index.html'));
      if (page) return page;
    } catch { /* A porta pode ainda não estar pronta durante o boot. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Tempo esgotado aguardando renderer Electron.');
}

/** Executa comandos CDP e correlaciona respostas pelo identificador. */
async function connectDebugger(url) {
  const socket = new WebSocket(url);
  // A conexão precisa de prazo explícito: uma Promise pendente não mantém o Node ativo.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Tempo esgotado conectando ao DevTools.')); }, 10000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('Falha ao conectar ao DevTools.')); };
  });
  let nextId = 0;
  const pending = new Map();
  // Rejeita comandos pendentes quando o renderer encerra a conexão inesperadamente.
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
        // Consultas sobre bibliotecas grandes podem levar mais que um frame de renderização.
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Tempo esgotado no comando DevTools: ${method}`)); }, 30000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

/** Mede cliente, moldura e DPI físicos no Windows para diagnosticar arredondamento. */
function windowsWindowMetrics(pid) {
  const command = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GameStockWindowMetrics {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][GameStockWindowMetrics]::SetThreadDpiAwarenessContext([IntPtr](-4))
$handle = (Get-Process -Id ${pid}).MainWindowHandle
if ($handle -eq 0) { throw 'Janela principal não encontrada.' }
$outer = New-Object GameStockWindowMetrics+Rect
$client = New-Object GameStockWindowMetrics+Rect
if (-not [GameStockWindowMetrics]::GetWindowRect($handle, [ref]$outer) -or -not [GameStockWindowMetrics]::GetClientRect($handle, [ref]$client)) { throw 'Falha ao medir janela.' }
@{ outerWidth = $outer.Right - $outer.Left; outerHeight = $outer.Bottom - $outer.Top; clientWidth = $client.Right - $client.Left; clientHeight = $client.Bottom - $client.Top; dpi = [GameStockWindowMetrics]::GetDpiForWindow($handle) } | ConvertTo-Json -Compress`;
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }));
}

/** Gera captura inicial e metadados sem alterar o perfil original da fixture. */
async function main() {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'artifacts', 'native-migration');
  const source = path.resolve(process.argv[2] || '.');
  if (path.dirname(source) !== artifacts || !path.basename(source).startsWith('fixtures-') || !fs.existsSync(path.join(source, 'legacy-populated', 'gamestock.db'))) {
    throw new Error('Informe o diretório fixtures-* gerado por scripts/native-fixtures.cjs.');
  }
  const exe = path.join(artifacts, 'electron-release', 'win-unpacked', 'GameStock.exe');
  if (!fs.existsSync(exe)) throw new Error('Gere primeiro a build Electron empacotada em electron-release.');
  // Valida dimensões e escala antes de criar ou alterar o perfil descartável.
  const sizeArg = process.argv.find((arg) => arg.startsWith('--size='));
  const sizeMatch = sizeArg && /^--size=(\d+)x(\d+)$/.exec(sizeArg);
  if (sizeArg && (!sizeMatch || Number(sizeMatch[1]) < 1024 || Number(sizeMatch[2]) < 768 || Number(sizeMatch[1]) > 7680 || Number(sizeMatch[2]) > 4320)) throw new Error('--size deve usar largura x altura entre 1024x768 e 7680x4320.');
  const scaleArg = process.argv.find((arg) => arg.startsWith('--scale='));
  const scale = scaleArg ? Number(scaleArg.slice('--scale='.length)) : 1;
  if (!Number.isFinite(scale) || scale < 1 || scale > 2) throw new Error('--scale deve estar entre 1 e 2.');
  const searchArg = process.argv.find((arg) => arg.startsWith('--search='));
  const search = searchArg ? searchArg.slice('--search='.length) : '';
  if (search && !process.argv.includes('--benchmark-only')) throw new Error('--search exige --benchmark-only para não navegar por resultados ausentes.');
  const output = fs.mkdtempSync(path.join(artifacts, 'electron-reference-'));
  const profile = path.join(output, 'profile');
  fs.cpSync(path.join(source, 'legacy-populated'), profile, { recursive: true });
  seedReferenceMetadata(profile);
  if (sizeMatch) fs.writeFileSync(path.join(profile, 'window-bounds.json'), JSON.stringify({ width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) }));
  relocateFixtureMedia(path.join(profile, 'gamestock.db'), path.join(source, 'legacy-populated'), profile);
  const countArg = process.argv.find((arg) => arg.startsWith('--games='));
  const gameCount = countArg ? Number(countArg.slice('--games='.length)) : 0;
  if (!Number.isSafeInteger(gameCount) || gameCount < 0 || gameCount > 100000) throw new Error('--games deve ser inteiro entre 0 e 100000.');
  if (gameCount) populateBenchmark(path.join(profile, 'gamestock.db'), gameCount);
  const port = 40000 + Math.floor(Math.random() * 20000);
  const started = Date.now();
  const child = spawn(exe, [`--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--force-device-scale-factor=${scale}`], {
    windowsHide: true,
    env: { ...process.env, GAMESTOCK_USER_DATA_DIR: profile, PORTABLE_EXECUTABLE_DIR: output },
    stdio: 'ignore'
  });
  let debuggerClient;
  try {
    const page = await waitForPage(port, child);
    const rendererFoundMs = Date.now() - started;
    debuggerClient = await connectDebugger(page.webSocketDebuggerUrl);
    await debuggerClient.command('Page.enable');
    // O primeiro frame pode preceder o carregamento dos dados assíncronos da biblioteca.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (search) {
      // Usar o setter nativo permite que o React observe a mesma alteração que uma digitação.
      const applied = await debuggerClient.command('Runtime.evaluate', { expression: `(() => { const input = document.querySelector('.topbar-search input'); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(search)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`, returnByValue: true });
      if (!applied.result.value) throw new Error('Campo de busca não encontrado.');
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    const info = await debuggerClient.command('Runtime.evaluate', { expression: 'JSON.stringify({title: document.title, width: innerWidth, height: innerHeight, scale: devicePixelRatio, screen: {width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight}, text: document.body.innerText})', returnByValue: true });
    // Os mesmos retângulos são exportados pelo protótipo Qt em pixels lógicos.
    const geometry = await debuggerClient.command('Runtime.evaluate', { expression: `(() => { const bounds = (selector) => { const item = document.querySelector(selector); if (!item) return null; const {x,y,width,height} = item.getBoundingClientRect(); return {x,y,width,height}; }; return {sidebar:bounds('.sidebar'),topbar:bounds('.topbar'),search:bounds('.topbar-search input'),firstCard:bounds('.game-card')}; })()`, returnByValue: true });
    if (geometry.exceptionDetails || !geometry.result.value) throw new Error('Falha ao obter geometria Electron.');
    // O tempo inclui a chamada IPC e resultados agrupados; não representa o tempo total de abertura do app.
    const timing = await debuggerClient.command('Runtime.evaluate', { expression: `(async () => { const values=[]; for (const filters of [{page:1},{page:2},{page:10},{page:1,search:'sintético 00001',collectionFilter:'favorites'},{page:1,sortBy:'mostPlayed'},{page:1,genre:' AÇÃO ',collectionFilter:'favorites'},{page:1,genre:'ος'},{page:1,genre:'i̇'}]) { const start=performance.now(); const result=await window.gameStockAPI.games.list({...filters,pageSize:36}); values.push({filters,ms:performance.now()-start,items:result.items.length,ids:result.items.map(item=>item.id),total:result.total,filtered:result.filtered}); } return values; })()`, returnByValue: true, awaitPromise: true });
    if (timing.exceptionDetails) throw new Error('Falha ao medir paginação Electron.');
    const genres = await debuggerClient.command('Runtime.evaluate', { expression: 'window.gameStockAPI.games.listGenres()', returnByValue: true, awaitPromise: true });
    if (genres.exceptionDetails) throw new Error('Falha ao listar gêneros Electron.');
    // A memória corresponde somente ao processo principal, sem os processos filhos do Electron.
    const mainWorkingSetBytes = Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${child.pid}).WorkingSet64`], { encoding: 'utf8', windowsHide: true }).trim());
    const nativeWindow = windowsWindowMetrics(child.pid);
    /** Nomes das capturas efetivamente gravadas, para conferir a cobertura do roteiro. */
    const captured = [];
    /** Salva cada estado somente depois de permitir a atualização assíncrona do renderer. */
    async function capture(name) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const screenshot = await debuggerClient.command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
      captured.push(name);
    }
    /** A falha de um seletor interrompe o roteiro em vez de gerar evidência incorreta. */
    async function click(expression) {
      const result = await debuggerClient.command('Runtime.evaluate', { expression, returnByValue: true });
      if (!result.result.value) throw new Error(`Controle não encontrado: ${expression}`);
    }
    /** Consulta opcional usada apenas em estados que dependem dos dados da fixture. */
    async function exists(expression) {
      const result = await debuggerClient.command('Runtime.evaluate', { expression, returnByValue: true });
      return Boolean(result.result.value);
    }
    await capture('biblioteca');
    if (!process.argv.includes('--benchmark-only')) {
    await click("(() => { const b = document.querySelector('.game-card'); if (!b) return false; b.click(); return true; })()");
    await capture('jogo-detalhe');
    await click("(() => { const b = document.querySelector('button[aria-label=Editar]'); if (!b) return false; b.click(); return true; })()");
    await capture('jogo-edicao');
    await click("(() => { const b = document.querySelector('[aria-labelledby=detail-edit-title] button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    // O jogo da fixture tem duas variantes; abrir a seleção não inicia o emulador falso.
    await click("(() => { const b = document.querySelector('.detail-hero-play-button'); if (!b) return false; b.click(); return true; })()");
    if (await exists("Boolean(document.querySelector('.game-version-modal'))")) {
      await capture('jogo-versao');
      await click("(() => { const b = document.querySelector('.game-version-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    }
    await click("(() => { const b = document.querySelector('.detail-top-button'); if (!b) return false; b.click(); return true; })()");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await click("(() => { const b = document.querySelector('.topbar button[title=Lista]'); if (!b) return false; b.click(); return true; })()");
    await capture('biblioteca-lista');
    await click("(() => { const b = [...document.querySelectorAll('.sidebar-nav button')].find(x => x.textContent.trim() === 'Inventário'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario');
    // Registra o formulário vazio sem salvar ou modificar os dados da fixture.
    await click("(() => { const b = [...document.querySelectorAll('.sidebar button')].find(x => x.textContent.trim() === 'Novo item'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-novo-item');
    await click("(() => { const b = document.querySelector('.hw-form-dialog button[title=\"Criar novo tipo\"]'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-novo-tipo');
    await click("(() => { const b = document.querySelector('.hw-form-dialog button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    // Captura detalhe e edição de um item sintético sem confirmar nenhuma alteração.
    await click("(() => { const b = document.querySelector('.hw-card'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-detalhe');
    await click("(() => { const b = document.querySelector('.hw-detail button[title=Editar]'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-edicao');
    await click("(() => { const b = document.querySelector('.hw-form-dialog button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    // A confirmação é apenas capturada e cancelada; a fixture não sofre exclusão.
    await click("(() => { const b = document.querySelector('.hw-detail button[title=Deletar]'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-confirmacao-exclusao');
    await click("(() => { const b = [...document.querySelectorAll('.hw-confirm-dialog button')].find(x => x.textContent.trim() === 'Cancelar'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.hw-detail .detail-top-button'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.hw-inventory button[title=Lista]'); if (!b) return false; b.click(); return true; })()");
    await capture('inventario-lista');
    await click("(() => { const b = [...document.querySelectorAll('.sidebar button')].find(x => x.textContent.trim() === 'Configurações'); if (!b) return false; b.click(); return true; })()");
    for (const [name, label] of [['plataformas','Plataformas'], ['emuladores','Emuladores'], ['pastas','Biblioteca'], ['midia','Mídia da biblioteca'], ['partidas','Partidas jogadas'], ['backup','Backup'], ['logs','Logs'], ['sobre','Sobre']]) {
      await click(`(() => { const b = [...document.querySelectorAll('.settings-nav-item')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);
      await capture(`configuracoes-${name}`);
    }
    /** Abre e fecha formulários sem salvar; a fixture permanece intacta. */
    const openSettingsSection = (label) => click(`(() => { const b = [...document.querySelectorAll('.settings-nav-item')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);
    await openSettingsSection('Plataformas');
    await click("(() => { const b = document.querySelector('.platform-add-button'); if (!b) return false; b.click(); return true; })()");
    await capture('plataformas-nova');
    await click("(() => { const b = document.querySelector('.platform-form-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.platform-list .platform-row .icon-button[title=\"Editar\"]'); if (!b) return false; b.click(); return true; })()");
    await capture('plataformas-edicao');
    await click("(() => { const b = document.querySelector('.platform-form-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.platform-list .platform-row .icon-button[title=\"Editar aliases e extensões\"]'); if (!b) return false; b.click(); return true; })()");
    await capture('plataformas-vinculos');
    await click("(() => { const b = document.querySelector('.platform-mappings-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await openSettingsSection('Emuladores');
    await click("(() => { const b = document.querySelector('.platform-add-button'); if (!b) return false; b.click(); return true; })()");
    await capture('emuladores-novo');
    await click("(() => { const b = document.querySelector('.emulator-form-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.emulator-row button[title=\"Editar\"]'); if (!b) return false; b.click(); return true; })()");
    await capture('emuladores-edicao');
    await click("(() => { const b = document.querySelector('.emulator-form-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.emulator-row button[title=\"Plataformas vinculadas\"]'); if (!b) return false; b.click(); return true; })()");
    await capture('emuladores-vinculos');
    await click("(() => { const b = document.querySelector('.emulator-link-btn'); if (!b) return false; b.click(); return true; })()");
    await capture('emuladores-vincular-plataforma');
    await click("(() => { const b = document.querySelector('.emulator-form-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.emulator-row button[title=\"Plataformas vinculadas\"]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = document.querySelector('.emulator-core-config-button'); if (!b) return false; b.click(); return true; })()");
    await capture('emuladores-cores');
    await click("(() => { const b = document.querySelector('.retroarch-core-dialog button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    // Fecha as configurações, volta à biblioteca e inicia uma exportação local para exibir o centro de notificações.
    await click("(() => { const b = document.querySelector('.settings-modal button[aria-label=Fechar]'); if (!b) return false; b.click(); return true; })()");
    await click("(() => { const b = [...document.querySelectorAll('.sidebar-nav button')].find(x => x.textContent.trim() === 'Biblioteca'); if (!b) return false; b.click(); return true; })()");
    const notificationBackup = path.join(output, 'notificacao-backup.gamestock-backup');
    await debuggerClient.command('Runtime.evaluate', { expression: `window.gameStockAPI.dataPortability.exportPackage({ categories: ['metadata', 'images', 'platforms', 'romLocations', 'inventoryImages'], targetPath: ${JSON.stringify(notificationBackup)} })`, returnByValue: true, awaitPromise: true });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await capture('notificacoes');
    }
    const pageInfo = JSON.parse(info.result.value);
    const electronVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
    fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify({ createdAt: new Date().toISOString(), electronVersion, nodeVersion: process.version, arch: process.arch, platform: os.release(), cpus: os.cpus()[0]?.model, totalMemory: os.totalmem(), requestedWindowSize: sizeMatch ? { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) } : null, requestedScale: scale, requestedSearch: search, additionalSyntheticGames: gameCount, rendererFoundMs, mainWorkingSetBytes, nativeWindow, screen: pageInfo.screen, geometry: geometry.result.value, pagination: timing.result.value, genres: genres.result.value, page: pageInfo, captures: captured, fixture: path.resolve(source), note: 'rendererFoundMs mede disponibilidade do DevTools, não abertura completa; memória inclui apenas processo principal. Medições não incluem importação. Capturas correspondem somente às telas alcançáveis pela UI atual; confirmações nativas e telas sem gatilho de UI não são capturadas.' }, null, 2));
    console.log(output);
  } finally {
    debuggerClient?.socket.close();
    child.kill();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
