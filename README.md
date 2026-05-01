# GameStock

GameStock is a Windows desktop app for managing retro game libraries, ROM paths, box art, and physical collection inventory. It is built with Electron, React, TypeScript, Vite, and SQLite.

## Features

- Local SQLite database stored under `%APPDATA%/GameStock/`
- Game CRUD with title, platform, publisher, year, genre, rating, notes, ROM path, and box art
- Platform list grouped by category with per-platform game counts
- Dark LaunchBox-inspired library UI with grid and list views
- Physical inventory tracking with condition values
- Native file dialogs for associating ROMs and importing cover images
- LaunchBox metadata and image importer using the public LaunchBox metadata archive
- Windows distribution through `electron-builder` with NSIS and portable targets

## Requirements

- Windows 11
- Node.js compatible with the project dependencies
- npm

## Install

```bash
npm install
```

The postinstall script runs `electron-builder install-app-deps` so native modules such as `better-sqlite3` match the Electron runtime.

## Development

```bash
npm run dev:windows
```

This starts Vite on `localhost:5173`, compiles the Electron main/preload code in watch mode, waits for both outputs, and opens Electron.

If your shell has `ELECTRON_RUN_AS_NODE` set, clear it before launching Electron manually:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
```

## Build

Compile the renderer:

```bash
npm run build:renderer
```

Compile Electron main and preload:

```bash
npm run build:main
```

Create Windows installer and portable builds:

```bash
npm run dist:windows
```

Build outputs are written to `release/`.

## Tests

Run the LaunchBox import smoke test against the compiled app:

```bash
npm run test:launchbox:e2e
```

Run the same flow against the packaged app contents in `release/win-unpacked/resources/app.asar`:

```bash
npm run test:launchbox:e2e:packaged
```

The packaged test builds the Windows distribution, ensures LaunchBox metadata is available, searches for "Sonic", imports "Box - Front" images, and checks that the renderer grid shows the imported game with a cover image.

## Local Data

GameStock stores runtime data outside the repository:

- Database: `%APPDATA%/GameStock/gamestock.db`
- Imported images: `%APPDATA%/GameStock/images/`
- LaunchBox cache: `%APPDATA%/GameStock/launchbox_cache/`
- Window bounds: `%APPDATA%/GameStock/window-bounds.json`

## LaunchBox Importer

The importer downloads `Metadata.zip` from the public LaunchBox games database and caches the extracted metadata locally. The first run can take a while because the metadata archive is large. Progress is reported through Electron IPC to the renderer.

## OpenSpec Status

The current OpenSpec change is `create-game-stock-app`.

Implemented tasks: `63/63`

All implementation tasks are complete.
