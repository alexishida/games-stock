## Context

GameStock currently has a functional Electron/React shell, SQLite persistence, LaunchBox import, platform/game repositories, grid/list views, and a game detail form. Several controls in the UI and native menu are still placeholders, and some repository capabilities are only reachable through code rather than complete user workflows. The change should build on the existing IPC, Zustand store, SQLite migration pattern, and dark UI rather than introducing a new architecture.

## Goals / Non-Goals

**Goals:**
- Complete common user workflows for maintaining a collection manually: create games, delete games, manage platforms, remove ROMs, filter by collection status, and sort the library.
- Persist new collection status fields so filters such as favorites, completed, and unplayed are real data-backed states.
- Keep native menu actions and visible renderer controls synchronized through the same store state.
- Preserve existing LaunchBox import behavior while allowing imported games to be organized with the same manual fields.

**Non-Goals:**
- Adding emulator launching, ROM scanning, cloud sync, user accounts, or multi-library support.
- Replacing the current SQLite repository layer or state management approach.
- Adding a full settings system beyond the management dialogs needed by this change.
- Changing the LaunchBox metadata download/indexing flow except where imported games interact with the new fields.

## Decisions

1. Extend the existing `games` table with `favorite INTEGER DEFAULT 0` and `play_status TEXT DEFAULT 'unplayed'`.

   This keeps favorites and status filters close to the rest of the game metadata, avoids a second table for an MVP-sized single-user app, and supports simple SQL filtering. The alternative was a normalized tags/status table, but that would add more UI and migration complexity than the current workflows need.

2. Expand `GameFilters` with `collectionFilter` and `sortBy` rather than creating separate list endpoints.

   The existing `games.list(filters?)` API already centralizes filtering and counts. Extending its payload keeps the renderer hooks simple and ensures grid/list views use identical data. Separate endpoints were considered, but they would duplicate count and search behavior.

3. Implement manual game and platform management as renderer modals using existing IPC methods.

   Modals fit the current app shape and avoid routing complexity. The existing platform repository already supports CRUD, so the main work is exposing a complete UI with validation, confirmation, refresh, and error states.

4. Make menu commands send explicit renderer events that update the shared store.

   The app already sends `view:set` and `launchbox` events from the native menu. Reusing this pattern for sorting, platform management, and game creation keeps Electron-specific behavior in the main process while letting React own application state.

5. Persist destructive or state-clearing detail actions immediately.

   `Associar ROM` already saves immediately after file selection. `Remover ROM` should follow the same model so the UI cannot suggest that a ROM is removed while the database still retains the path.

## Risks / Trade-offs

- Existing databases do not have the new columns -> Use idempotent migrations with `ALTER TABLE` guarded by schema inspection or safe try/catch.
- More filters can make counts confusing -> Keep `total` as all games and `filtered` as the result after platform/search/status filters, matching the existing counter pattern.
- Platform deletion can fail when games exist -> Surface repository validation errors in the platform management modal instead of silently closing it.
- Native menu and renderer controls may drift -> Route both through the same store setters and test menu-triggered events.
- Play status labels may grow later -> Store stable values (`unplayed`, `playing`, `completed`) while rendering localized labels in the UI.

## Migration Plan

1. Add idempotent database migrations for `favorite` and `play_status`.
2. Update shared types and repository filters/sorting.
3. Update renderer store and hooks to pass new filters.
4. Add UI workflows and wire native menu events.
5. Verify build, manual CRUD flows, filters, sorting, and existing LaunchBox import.
