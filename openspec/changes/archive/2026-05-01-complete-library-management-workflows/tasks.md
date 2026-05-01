## 1. Data Model and Shared Contracts

- [x] 1.1 Add idempotent SQLite migrations for `games.favorite` and `games.play_status`
- [x] 1.2 Update shared game types with `favorite`, `play_status`, collection filter, and sort options
- [x] 1.3 Update IPC channel/type declarations for new menu events and expanded game filters

## 2. Game Repository Workflows

- [x] 2.1 Update `normalizeInput`, row mapping, create, update, and LaunchBox upsert behavior for the new fields
- [x] 2.2 Extend `games.list(filters)` to support collection filters for favorites, completed, and unplayed
- [x] 2.3 Extend `games.list(filters)` to support sorting by title, year, and recent additions
- [x] 2.4 Verify delete behavior refreshes correctly through existing IPC response shape

## 3. Renderer State and Hooks

- [x] 3.1 Add collection filter, sort selection, game creation dialog state, and platform manager dialog state to the Zustand store
- [x] 3.2 Update `useGames` to pass collection and sort filters to `window.gameStockAPI.games.list`
- [x] 3.3 Ensure imported, created, updated, and deleted games trigger a library reload and clear stale selection when needed

## 4. Manual Game Management UI

- [x] 4.1 Create a manual game modal/form with required title and platform fields plus optional metadata fields
- [x] 4.2 Wire the floating add or equivalent visible action to open the manual game flow while preserving LaunchBox import access
- [x] 4.3 Add delete action with confirmation to the game detail view
- [x] 4.4 Add favorite and play status controls to the game detail form
- [x] 4.5 Persist "Remover ROM" immediately and refresh the library after success

## 5. Platform Management UI

- [x] 5.1 Create a platform management modal listing platforms with category and game counts
- [x] 5.2 Add create and edit platform forms using the existing platform IPC methods
- [x] 5.3 Add delete platform action with confirmation and visible validation errors for platforms with games
- [x] 5.4 Refresh platform data and related library views after platform changes

## 6. Library Filters, Sorting, and Menus

- [x] 6.1 Replace placeholder library tabs with functional filters for all games, favorites, completed, and unplayed
- [x] 6.2 Replace placeholder sort controls with functional title, year, and recent sorting
- [x] 6.3 Update native menu items to open manual/platform workflows and apply view/sort actions through renderer events
- [x] 6.4 Keep top bar, library header, native menu events, grid, and list views synchronized through the shared store

## 7. Verification

- [x] 7.1 Run `npm run build:renderer`
- [x] 7.2 Run `npm run build:main`
- [ ] 7.3 Manually verify create, edit, delete, ROM removal, platform management, filters, sorting, and LaunchBox import regression
