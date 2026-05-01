const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, net, protocol } = require("electron");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const distRoot = process.env.GAMESTOCK_E2E_PACKAGED
  ? path.join(root, "release", "win-unpacked", "resources", "app.asar", "dist")
  : path.join(root, "dist");
const distMain = path.join(distRoot, "main");
const distShared = path.join(distRoot, "shared");
const distRenderer = path.join(distRoot, "renderer", "index.html");
const distPreload = path.join(distRoot, "preload", "index.js");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "gamestock-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

async function main() {
  await app.whenReady();
  registerMediaProtocol();

  const { IPC_CHANNELS } = require(path.join(distShared, "ipc-channels.js"));
  const database = require(path.join(distMain, "database.js"));
  const games = require(path.join(distMain, "repositories", "games.js"));
  const platforms = require(path.join(distMain, "repositories", "platforms.js"));
  const launchbox = require(path.join(distMain, "launchbox", "index.js"));

  database.getDatabase();
  registerHandlers(IPC_CHANNELS, games, platforms);

  const progress = (event) => {
    if (event.status === "downloading" && event.filename === "Metadata.zip") {
      const mb = event.total ? `${Math.round(event.current / 1_048_576)}/${Math.round(event.total / 1_048_576)} MB` : `${event.current} bytes`;
      console.log(`metadata: ${mb}`);
    } else if (event.filename) {
      console.log(`asset: ${event.status} ${event.filename}`);
    }
  };

  console.log("ensuring LaunchBox metadata...");
  await launchbox.ensureLaunchBoxMetadata(false, progress);

  console.log('searching "Sonic"...');
  const results = await launchbox.searchGames({ query: "Sonic", platformKey: "megadrive" });
  const sonic = results.find((game) => game.name.toLowerCase() === "sonic the hedgehog") ?? results[0];
  if (!sonic) throw new Error('No LaunchBox result found for "Sonic"');

  console.log(`importing ${sonic.name} [${sonic.platform}]...`);
  const imported = await launchbox.importGame({ launchboxGameId: sonic.id, imageTypes: ["Box - Front"] }, progress);
  const saved = games.getGame(imported.gameId);
  if (!saved) throw new Error("Imported game was not saved in SQLite");
  if (!saved.box_art_path || !fs.existsSync(saved.box_art_path)) throw new Error(`Box art file was not created: ${saved.box_art_path}`);

  console.log("opening renderer and checking grid...");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: distPreload
    }
  });

  win.webContents.on("console-message", (_event, _level, message) => {
    console.log(`renderer: ${message}`);
  });

  await win.loadFile(distRenderer);
  await waitForRenderer(win);

  const visible = await win.webContents.executeJavaScript(`
    Boolean(
      Array.from(document.querySelectorAll('.game-title')).some((node) => /sonic/i.test(node.textContent || '')) &&
      document.querySelector('.game-card img')
    )
  `);

  if (!visible) throw new Error("Renderer grid did not show Sonic with a box-art image");
  console.log(`ok: Sonic imported as game ${saved.id}; box art: ${saved.box_art_path}`);
}

function registerMediaProtocol() {
  protocol.handle("gamestock-media", (request) => {
    const filePath = new URL(request.url).searchParams.get("path");
    if (!filePath) return new Response("Missing path", { status: 400 });
    const normalized = path.resolve(filePath);
    const allowedRoot = path.resolve(path.join(app.getPath("appData"), "GameStock"));
    if (!normalized.startsWith(allowedRoot)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(normalized).toString());
  });
}

function registerHandlers(channels, games, platforms) {
  ipcMain.handle(channels.games.list, (_event, filters) => games.listGames(filters));
  ipcMain.handle(channels.games.get, (_event, id) => games.getGame(id));
  ipcMain.handle(channels.platforms.list, () => platforms.listPlatforms());
}

async function waitForRenderer(win) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    const ready = await win.webContents.executeJavaScript(`
      document.querySelectorAll('.game-title').length > 0 ||
      Boolean(document.querySelector('.empty-state'))
    `);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const body = await win.webContents.executeJavaScript("document.body.innerText.slice(0, 1000)");
  const html = await win.webContents.executeJavaScript("document.body.innerHTML.slice(0, 1000)");
  throw new Error(`Renderer did not finish loading games. Body: ${body} HTML: ${html}`);
}

main()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
