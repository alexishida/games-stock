## 1. Contracts and IPC

- [x] 1.1 Add data portability types to `src/shared/types.ts` for categories, export request/result, import preview, import request/result, manifest and warnings.
- [x] 1.2 Add `dataPortability` channels to `src/shared/ipc-channels.ts`.
- [x] 1.3 Expose `window.gameStockAPI.dataPortability.exportPackage`, `previewImport` and `importPackage` in `src/preload/index.ts`.
- [x] 1.4 Update `src/preload/types.d.ts` with the new API namespace and request/result types.

## 2. Main Process Data Portability

- [x] 2.1 Create main-process portability module for package creation, package reading and schemaVersion validation.
- [x] 2.2 Implement export of `metadata` from `games` without image paths or `rom_path`.
- [x] 2.3 Implement export of `platforms` including platforms, aliases, ROM extensions, emulators and platform-emulator links.
- [x] 2.4 Implement export of `images` by copying referenced image files into `media/` and writing a media map with missing-file warnings.
- [x] 2.5 Implement export of `romLocations` including per-game `rom_path` and renderer-provided ROM folder entries.
- [x] 2.6 Implement import preview with category detection, counts, compatibility errors, conflict counts and missing path warnings.
- [x] 2.7 Implement transactional import for metadata, platforms and ROM paths using stable matching instead of raw SQLite IDs.
- [x] 2.8 Implement image import by copying media files into the current images directory and rewriting game image fields.
- [x] 2.9 Register data portability IPC handlers in `src/main/index.ts`.

## 3. Settings UI

- [x] 3.1 Create `DataPortabilitySettings` component for Configuracoes > Geral with checkbox categories and export/import actions.
- [x] 3.2 Read `gamestock.romImport.folderEntries` from localStorage for export when `romLocations` is selected.
- [x] 3.3 Implement import file selection, preview display, category selection and confirmation inside the SettingsModal flow.
- [x] 3.4 Persist imported ROM folder entries back to `gamestock.romImport.folderEntries` only after successful import.
- [x] 3.5 Integrate `DataPortabilitySettings` into `SettingsModal` and keep existing Geral cards or replace them with equivalent app info.
- [x] 3.6 Add CSS following `.ai-framework/DESIGN.md` and existing SettingsModal patterns, using Lucide icons for actions.

## 4. Validation

- [x] 4.1 Verify `npm run build:main` passes.
- [x] 4.2 Verify `npm run build:renderer` passes.
- [x] 4.3 Manually test exporting each category alone and all categories together.
- [x] 4.4 Manually test importing a valid package into a library with existing games and confirm conflict handling.
- [x] 4.5 Manually test invalid package, unsupported schemaVersion, missing image file and nonexistent ROM path warning flows.

## 5. Background Jobs and Notifications

- [x] 5.1 Add data portability job/progress/completed types and IPC channels.
- [x] 5.2 Move export/import execution to a main-process worker thread with progress callbacks.
- [x] 5.3 Track data portability jobs in Zustand and subscribe to progress/completed events in App.
- [x] 5.4 Show export/import progress in Settings > Geral and NotificationCenter.
- [x] 5.5 Verify build and smoke-test worker export/import progress.
