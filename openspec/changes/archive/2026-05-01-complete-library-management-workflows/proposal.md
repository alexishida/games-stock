## Why

GameStock already has the core shell, data model, LaunchBox import, grid/list views, and detail editing, but several day-to-day library management controls are still incomplete or only visual. This change turns the MVP from an importer/browser into a usable collection manager where users can create, organize, filter, sort, and clean up their library without leaving the app.

## What Changes

- Add manual game creation from the library UI, including platform selection and core metadata fields.
- Add game deletion with confirmation and immediate library refresh.
- Persist ROM removal from the game detail form instead of only updating local draft state.
- Add platform management UI for creating, editing, and deleting platforms using the existing platform IPC APIs.
- Make library sorting functional for title, year, and recent additions.
- Replace placeholder tabs for favorites, completed, and unplayed with real filtering backed by persisted game fields.
- Wire menu/toolbar controls to the same library state so native menu items and visible UI stay consistent.

## Capabilities

### New Capabilities
- `library-management-workflows`: Covers user-facing workflows for manually maintaining games and platforms, including create/delete actions, persisted ROM removal, sorting, and collection status filters.

### Modified Capabilities
- `game-library`: Add persisted user collection fields needed for favorites and play status, and extend list filtering/sorting behavior.
- `platform-manager`: Add explicit UI-driven platform management scenarios on top of the existing platform CRUD API.
- `rom-association`: Clarify that removing a ROM association persists immediately when the user clicks the remove action.
- `library-ui`: Replace non-functional placeholder filters and sort controls with real interactive library controls.
- `app-shell`: Enable relevant native menu entries to drive library view state and management dialogs.

## Impact

- Main process database migrations for new game fields such as favorite and play status.
- Game repository list filters and sorting parameters.
- Shared types and IPC payloads for library filters, sorting, and game create/update data.
- Renderer store, hooks, top bar, library header, game detail form, and new modal/dialog components for game and platform management.
- OpenSpec requirements for affected library, platform, ROM, UI, and app shell behavior.
