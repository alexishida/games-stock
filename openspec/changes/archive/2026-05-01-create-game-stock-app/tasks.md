## 1. Scaffolding do Projeto

- [x] 1.1 Criar `package.json` com dependências: electron@^41, react@^19, react-dom@^19, typescript@^5, vite@^7, better-sqlite3, zustand, react-window, adm-zip, xml2js, concurrently, wait-on, electron-builder, electron-rebuild e tipos TypeScript correspondentes (`@types/better-sqlite3`, `@types/adm-zip`, `@types/xml2js`, `@types/react`, `@types/react-dom`, `@types/react-window`)
- [x] 1.2 Criar `tsconfig.json` base, `tsconfig.main.json` (CommonJS, target node) e `tsconfig.renderer.json` (ESNext, DOM)
- [x] 1.3 Criar `vite.config.ts` configurado para o renderer com base `./src/renderer` e outDir `./dist/renderer`
- [x] 1.4 Criar estrutura de diretórios: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
- [x] 1.5 Adicionar scripts npm: `dev:windows`, `build:renderer`, `build:main`, `dist:windows`, `postinstall` (electron-rebuild)
- [x] 1.6 Criar `.gitignore` excluindo `dist/`, `node_modules/`, `*.db`

## 2. Tipos Compartilhados

- [x] 2.1 Criar `src/shared/types.ts` com interfaces: `Platform`, `Game`, `GameFilters`, `GameListResult`, `PhysicalCondition` (enum), `LaunchBoxGame`, `LaunchBoxImage`, `LaunchBoxImageType` (union dos 10 tipos), `LaunchBoxSearchParams`, `LaunchBoxDownloadResult`, `LaunchBoxProgress`, `LaunchBoxImportParams`
- [x] 2.2 Criar `src/shared/ipc-channels.ts` com constantes de canais IPC: `games:*`, `platforms:*`, `dialogs:*`, `shell:openPath`, `launchbox:ensureMetadata`, `launchbox:searchGames`, `launchbox:downloadImages`, `launchbox:importGame`, `launchbox:progress` (evento push)

## 3. Processo Main — Banco de Dados

- [x] 3.1 Criar `src/main/database.ts`: inicializar better-sqlite3, criar/abrir `%APPDATA%/GameStock/gamestock.db`, aplicar schema SQL com tabelas `platforms` e `games` — incluir coluna `launchbox_id TEXT` em `games` para rastrear origem do import
- [x] 3.2 Adicionar seed de plataformas padrão no primeiro uso (Sega Genesis, Nintendo 64, Sega Saturn, Game Boy, SNES, NES) com suas categorias
- [x] 3.3 Criar `src/main/repositories/games.ts` com funções: `listGames(filters)`, `getGame(id)`, `createGame(data)`, `updateGame(id, data)`, `deleteGame(id)` — retornando `GameListResult` com `items`, `total`, `filtered`
- [x] 3.4 Criar `src/main/repositories/platforms.ts` com funções: `listPlatforms()` (com `gameCount`), `createPlatform(data)`, `updatePlatform(id, data)`, `deletePlatform(id)` — com validação de duplicata e de plataforma com jogos

## 4. Processo Main — Janela e IPC

- [x] 4.1 Criar `src/main/index.ts`: criar `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `preload: dist/preload/index.js`, tamanho mínimo 1024×768, título "GameStock", persistir bounds via `electron-store` ou arquivo JSON
- [x] 4.2 Registrar handlers IPC para `games:*` channels delegando para `games.ts` repository
- [x] 4.3 Registrar handlers IPC para `platforms:*` channels delegando para `platforms.ts` repository
- [x] 4.4 Registrar handler IPC para `dialogs:openRomFile` abrindo `dialog.showOpenDialog` com filtros de extensões ROM
- [x] 4.5 Registrar handler IPC para `dialogs:openImageFile` abrindo `dialog.showOpenDialog` com filtros de imagem; copiar arquivo para `%APPDATA%/GameStock/images/` e retornar novo caminho
- [x] 4.6 Registrar handler IPC para `shell:openPath` chamando `shell.openPath(path)`
- [x] 4.7 Criar menu nativo Electron com itens: MENU (com submenu Sair), FERRAMENTAS, VISUALIZAÇÃO (Grade, Lista), ORGANIZADO POR, GRUPO DE IMAGENS, EMBLEMAS

## 5. Processo Preload

- [x] 5.1 Criar `src/preload/index.ts` expondo `window.gameStockAPI` via `contextBridge.exposeInMainWorld` com namespaces `games`, `platforms`, `dialogs`, `shell` — cada método chamando `ipcRenderer.invoke(channel, ...args)`
- [x] 5.2 Criar `src/preload/types.d.ts` declarando `interface Window { gameStockAPI: GameStockAPI }` com tipos completos de cada método

## 6. Renderer — Setup React

- [x] 6.1 Criar `src/renderer/index.html` com `<div id="root">` e script apontando para `main.tsx`
- [x] 6.2 Criar `src/renderer/main.tsx` com `ReactDOM.createRoot` e importação do `App`
- [x] 6.3 Criar `src/renderer/styles/global.css` com reset CSS, variáveis de tema escuro (`--bg-primary: #1a1a2e`, `--bg-sidebar: #16213e`, `--accent: #2563eb`, `--text-primary: #e2e8f0`, `--text-secondary: #94a3b8`) e fonte base
- [x] 6.4 Criar `src/renderer/store/index.ts` com Zustand store contendo: `selectedPlatformId`, `searchQuery`, `viewMode` (grid/list), `games`, `platforms`, `loading`, ações para cada campo

## 7. Renderer — Componentes de Layout

- [x] 7.1 Criar `src/renderer/components/TopBar/TopBar.tsx`: barra horizontal com itens de menu (MENU, FERRAMENTAS, VISUALIZAÇÃO, ORGANIZADO POR, GRUPO DE IMAGENS, EMBLEMAS) e contador "Exibindo X de Y total de jogos" alinhado à direita
- [x] 7.2 Criar `src/renderer/components/Sidebar/Sidebar.tsx`: container com busca, dropdown de categoria e árvore de plataformas; largura fixa 220px, fundo `--bg-sidebar`
- [x] 7.3 Criar `src/renderer/components/Sidebar/SearchInput.tsx`: input de busca com ícone de lupa e botão de filtro; ao digitar, atualiza `searchQuery` no store
- [x] 7.4 Criar `src/renderer/components/Sidebar/CategoryDropdown.tsx`: select nativo com opção "Categoria da Plataforma" e opções dinâmicas por categoria
- [x] 7.5 Criar `src/renderer/components/Sidebar/PlatformTree.tsx`: renderiza item "Todos" e grupos expansíveis por categoria, cada plataforma com `gameCount`; item selecionado destacado com `--accent`
- [x] 7.6 Criar `src/renderer/App.tsx` compondo `TopBar`, `Sidebar` e área principal com layout `display: flex`

## 8. Renderer — Grade de Jogos

- [x] 8.1 Criar `src/renderer/components/GameGrid/GameGrid.tsx`: grade virtualizada com `react-window` (FixedSizeGrid ou VariableSizeGrid), colunas de 150px, calculando número de colunas pela largura do container com `ResizeObserver`
- [x] 8.2 Criar `src/renderer/components/GameGrid/GameCard.tsx`: card com `box_art_path` (img) ou placeholder (ícone + nome plataforma), título truncado, publisher em `--text-secondary`, badge físico se `owned_physical = true`, borda de destaque se selecionado
- [x] 8.3 Criar `src/renderer/components/GameGrid/GameCardPlaceholder.tsx`: placeholder SVG/div com ícone de gamepad, cor de fundo por plataforma (opcional), nome da plataforma
- [x] 8.4 Criar `src/renderer/components/GameGrid/PhysicalBadge.tsx`: badge/ícone de cartucho sobreposto no canto inferior do card quando `owned_physical = true`

## 9. Renderer — Visualização em Lista

- [x] 9.1 Criar `src/renderer/components/GameList/GameList.tsx`: lista virtualizada com `react-window` (FixedSizeList), cada linha exibindo thumbnail, título, plataforma, publisher, ano e badge físico em colunas
- [x] 9.2 Criar `src/renderer/components/GameList/GameListRow.tsx`: linha da tabela com as colunas definidas; destaque na linha selecionada

## 10. Renderer — Painel de Detalhes do Jogo

- [x] 10.1 Criar `src/renderer/components/GameDetail/GameDetail.tsx`: painel lateral direito (ou modal) com todos os campos do jogo em modo visualização
- [x] 10.2 Criar `src/renderer/components/GameDetail/GameForm.tsx`: formulário de edição de jogo com campos: título, publisher, ano, gênero, rating, notas; salva via `window.gameStockAPI.games.update`
- [x] 10.3 Adicionar seção de inventário físico no `GameForm`: toggle `owned_physical` e select de `physical_condition` (visível apenas quando `owned_physical = true`)
- [x] 10.4 Adicionar botão "Associar ROM" que chama `window.gameStockAPI.dialogs.openRomFile` e salva o caminho retornado
- [x] 10.5 Adicionar botão "Importar Box Art" que chama `window.gameStockAPI.dialogs.openImageFile` e atualiza `box_art_path`

## 11. Integração e Carregamento de Dados

- [x] 11.1 Criar `src/renderer/hooks/useGames.ts`: hook que carrega jogos via `window.gameStockAPI.games.list(filters)` ao montar e ao mudar `selectedPlatformId` ou `searchQuery` no store
- [x] 11.2 Criar `src/renderer/hooks/usePlatforms.ts`: hook que carrega plataformas via `window.gameStockAPI.platforms.list()` ao montar
- [x] 11.3 Conectar `TopBar` ao store para exibir contagem real de `filtered` e `total`
- [x] 11.4 Conectar o toggle de visualização (grade/lista) no `TopBar` ao `viewMode` do store; `App` renderiza `GameGrid` ou `GameList` conforme o valor
- [x] 11.5 Conectar o filtro "Apenas físicos" ao store e ao `GameFilters` passados para `games.list`

## 13. Integração LaunchBox

- [x] 13.1 Criar `src/main/launchbox/config.ts` portando `launchbox-downloader/src/config.js`: constantes `METADATA_URL`, `IMAGES_BASE`, `CACHE_DIR` (usando `app.getPath('userData')`), mapa `PLATFORMS` com todos os aliases de plataforma, mapa `IMAGE_TYPES` com os 10 tipos
- [x] 13.2 Criar `src/main/launchbox/db.ts` portando `launchbox-downloader/src/db.js`: funções `ensureMetadata(force?)` e `buildIndex()` — substituir `node-fetch` por `fetch` nativo, remover `chalk`/`cli-progress`, emitir progresso via callback injetado, cache em `%APPDATA%/GameStock/launchbox_cache/`, manter índice como singleton de módulo
- [x] 13.3 Criar `src/main/launchbox/scraper.ts` portando `launchbox-downloader/src/scraper.js`: funções `searchGames(index, params)` e `downloadImages(game, outputDir, types, onProgress)` — remover `chalk`/`cli-progress`, aceitar `onProgress` callback para emissão via IPC, destino das imagens em `%APPDATA%/GameStock/images/<game-title>/`
- [x] 13.4 Criar `src/main/launchbox/index.ts` exportando API pública: `ensureMetadata`, `buildIndex`, `searchGames`, `downloadImages`, `importGame` — `importGame` orquestra search + download + upsert SQLite, resolvendo plataforma via mapa de aliases
- [x] 13.5 Registrar handlers IPC `launchbox:*` em `src/main/index.ts` — `launchbox:progress` usa `mainWindow.webContents.send` (push) em vez de `ipcMain.handle` (invoke)
- [x] 13.6 Adicionar namespace `launchbox` ao preload `contextBridge`: métodos invoke para `ensureMetadata`, `searchGames`, `downloadImages`, `importGame`; método `onProgress(cb)` via `ipcRenderer.on('launchbox:progress', cb)` retornando função de cleanup (unlisten)
- [x] 13.7 Criar `src/renderer/components/LaunchBoxImporter/LaunchBoxImporter.tsx`: modal com campo de busca, dropdown de plataforma (alimentado pelo `PLATFORMS` config), lista de resultados com nome/plataforma/contagem de imagens, checkboxes de tipos de imagem, barra de progresso, botão "Importar"
- [x] 13.8 Criar `src/renderer/components/LaunchBoxImporter/ProgressBar.tsx`: componente de barra de progresso que escuta `launchbox.onProgress(cb)` e exibe `current/total` e nome do arquivo atual
- [x] 13.9 Criar `src/renderer/hooks/useLaunchBoxImporter.ts`: hook que gerencia estado do importador (query, resultados, jogo selecionado, tipos selecionados, progresso, loading) e expõe `search`, `import` actions
- [x] 13.10 Adicionar item de menu FERRAMENTAS → "Importar do LaunchBox" que abre o `LaunchBoxImporter` modal
- [x] 13.11 Ao concluir importação com sucesso no `LaunchBoxImporter`, invalidar cache do hook `useGames` para a grade recarregar com o novo jogo

## 14. Build e Distribuição

- [x] 14.1 Criar `electron-builder.yml` com configuração: appId `com.gamestock.app`, productName "GameStock", directories output `release/`, win target `nsis` e `portable`, incluir `dist/` e `node_modules/`
- [x] 14.2 Verificar que `dev:windows` funciona: Vite sobe em `localhost:5173`, `wait-on` aguarda, electron abre apontando para o Vite dev server
- [x] 14.3 Verificar que `dist:windows` gera installer e portable em `release/` sem erros de módulo nativo (better-sqlite3 e adm-zip rebuilados para a versão correta do Electron)
- [x] 14.4 Testar abertura do app instalado/portátil: banco criado em `%APPDATA%/GameStock/`, plataformas seed carregadas, UI exibida corretamente
- [x] 14.5 Testar fluxo LaunchBox end-to-end no build distribuído: abrir importador, aguardar download do Metadata.zip, buscar "Sonic", importar com "Box - Front" selecionada, verificar que a capa aparece na grade
