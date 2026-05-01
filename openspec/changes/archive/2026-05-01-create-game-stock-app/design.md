## Context

Projeto novo criado do zero. Não há código preexistente nem dependências legadas. O GameStock é um app desktop Windows que gerencia bibliotecas de ROMs e inventário físico de coleção. A referência de UX é o LaunchBox: grade de box arts, painel lateral de plataformas, barra de menu com ações.

Stack definida pelo usuário: Electron 41, React 19, TypeScript 5, Vite 7, better-sqlite3.

O projeto `launchbox-downloader` (em `launchbox-downloader/` na raiz do repositório) já está funcionando e contém toda a lógica de download de metadados e imagens da LaunchBox. Suas classes/funções serão adaptadas para TypeScript e integradas ao processo main do Electron, sem reescrita — apenas portagem de ESM JS → CommonJS TypeScript com ajustes de ambiente (paths, progress, fetch).

## Goals / Non-Goals

**Goals:**
- Estrutura Electron com processos main/preload/renderer isolados e IPC seguro via contextBridge
- Banco SQLite local com melhor-sqlite3 (síncrono no processo main)
- UI React com grade de box arts fiel ao LaunchBox
- Painel lateral com árvore de plataformas (categoria → plataforma)
- Busca e filtros por plataforma em tempo real
- Inventário físico: flag owned_physical por jogo
- Associação de arquivos ROM via diálogo nativo Electron
- Build Windows via electron-builder (NSIS installer + portable)
- Dev workflow com Vite HMR + electron-reload

**Non-Goals:**
- Multiplataforma (apenas Windows nesta versão)
- Emulação integrada (o app apenas lança o emulador)
- Sync em nuvem ou multiplayer
- Autenticação de usuário

## Decisions

### D1: Arquitetura Electron — processos separados com IPC tipado

**Decisão**: `src/main/` (Node.js puro), `src/preload/` (contextBridge), `src/renderer/` (React+Vite), `src/shared/` (tipos TS compartilhados).

**Rationale**: Isolamento de segurança obrigatório no Electron moderno (`contextIsolation: true`, `nodeIntegration: false`). O preload expõe uma API `window.gameStockAPI` fortemente tipada — o renderer nunca acessa Node.js diretamente.

**Alternativa descartada**: `nodeIntegration: true` — inseguro, deprecado, incompatível com CSP.

### D2: better-sqlite3 em vez de sqlite3 assíncrono

**Decisão**: `better-sqlite3` no processo main com queries síncronas.

**Rationale**: O processo main do Electron não bloqueia a UI (são processos separados). Queries síncronas simplificam muito o código — sem callbacks/promises no acesso ao banco. better-sqlite3 é mais rápido e tem API mais limpa para TypeScript.

**Alternativa descartada**: `sqlite3` assíncrono — complexidade desnecessária para um banco local desktop.

### D3: Vite 7 apenas para o renderer

**Decisão**: Vite 7 processa `src/renderer/`. Main e preload são compilados com `tsc` diretamente para `dist/main/` e `dist/preload/`.

**Rationale**: Vite não suporta bem módulos CommonJS que o Electron main precisa. tsc direto é simples e suficiente para arquivos que não precisam de HMR. O renderer se beneficia do HMR do Vite durante o dev.

**Build output**:
```
dist/
  main/       ← tsc compila src/main/
  preload/    ← tsc compila src/preload/
  renderer/   ← vite build de src/renderer/
```

### D4: Schema SQLite — tabelas principais

```sql
platforms (id, name, category, created_at)
games (
  id, title, platform_id, publisher, year, genre, rating,
  box_art_path, rom_path, owned_physical, physical_condition,
  notes, created_at, updated_at
)
```

**Rationale**: Schema simples e flat. Sem ORM — SQL direto com better-sqlite3 para máximo controle e performance.

### D5: IPC API exposta via contextBridge

```typescript
window.gameStockAPI = {
  games: { list, get, create, update, delete },
  platforms: { list, create, update, delete },
  dialogs: { openRomFile, openImageFile },
  shell: { openPath },
  launchbox: {
    ensureMetadata,   // baixa/atualiza Metadata.zip → cache local
    searchGames,      // busca no índice em memória
    downloadImages,   // baixa imagens de um jogo para AppData/images/
    importGame,       // search + downloadImages + INSERT no SQLite
    onProgress,       // escuta eventos de progresso (IPC event listener)
  }
}
```

**Rationale**: Superfície mínima de API. Cada método no renderer dispara `ipcRenderer.invoke()` → handler no main → retorna resultado. Progresso de download é push (main → renderer via `webContents.send`) em vez de pull. Tipos compartilhados em `src/shared/types.ts`.

### D6: UI — grade de box arts com CSS Grid + React virtualization

**Decisão**: `react-window` para virtualização da grade. CSS Grid com `auto-fill` e colunas de largura fixa (~150px).

**Rationale**: Coleções grandes (500+ jogos) precisam de virtualização para scroll fluido. CSS Grid nativo é suficiente para o layout — sem biblioteca de UI pesada.

**Paleta de cores** (LaunchBox-inspired dark theme):
- Background: `#1a1a2e`
- Sidebar: `#16213e`
- Card hover: `#0f3460`
- Accent/selected: `#2563eb`
- Text primário: `#e2e8f0`
- Text secundário: `#94a3b8`

### D7: Estado global — Zustand

**Decisão**: Zustand para estado global (plataforma selecionada, busca, jogos carregados, view mode).

**Rationale**: Leve, sem boilerplate, TypeScript-first. Suficiente para este app — Redux seria excessivo.

### D8: Scripts npm

```json
{
  "dev:windows": "concurrently \"vite\" \"tsc -p tsconfig.main.json -w\" \"electron .\"",
  "build:renderer": "vite build",
  "build:main": "tsc -p tsconfig.main.json",
  "dist:windows": "npm run build:renderer && npm run build:main && electron-builder --win"
}
```

### D9: Portagem do launchbox-downloader — JS ESM → TypeScript CommonJS

**Decisão**: Os módulos `config.js`, `db.js` e `scraper.js` do projeto `launchbox-downloader` são portados para `src/main/launchbox/config.ts`, `db.ts` e `scraper.ts`. Sem reescrita de lógica — apenas:
1. `import` → `require` / tipos TypeScript adicionados
2. `~/.launchbox_cache/` → `path.join(app.getPath('userData'), 'launchbox_cache')`
3. `node-fetch` removido — usa `fetch` nativo (Node 18+ / Electron 41)
4. `chalk` e `cli-progress` removidos — progresso emitido via IPC (`webContents.send`)

**Rationale**: Reutilizar código já testado sem duplicação. A lógica de parse de XML, construção de índice e download de imagens é não-trivial — não faz sentido reescrever.

**Arquivos resultantes**:
```
src/main/launchbox/
  config.ts   ← platform mappings, image types, URLs, cache paths
  db.ts       ← ensureMetadata(), buildIndex(), índice em memória cacheado
  scraper.ts  ← searchGames(), downloadImages()
  index.ts    ← re-exports da API pública
```

### D10: Índice LaunchBox em memória + cache em disco

**Decisão**: `buildIndex()` mantém o índice de jogos em uma variável de módulo singleton no processo main. Na primeira chamada de sessão, carrega do arquivo `launchbox_cache/index.json` (se recente). O Metadata.zip (~200 MB) é baixado/atualizado apenas se tiver mais de 24 horas ou forçado.

**Rationale**: Parse do XML completo da LaunchBox leva segundos — manter em memória entre buscas é obrigatório para UX responsiva. O índice pode ter 500k+ entradas; o cache JSON evita reparse a cada sessão.

### D11: Mapeamento LaunchBox platform → GameStock platform

**Decisão**: `config.ts` mantém o mapa `PLATFORMS` do launchbox-downloader (chave curta → array de nomes LaunchBox, ex: `megadrive → ["Sega Mega Drive", "Sega Genesis", ...]`). Na importação de um jogo, o `platform` do LaunchBox é comparado contra os aliases do mapa para encontrar o `platform_id` correto no banco GameStock. Se não encontrado, cria nova plataforma automaticamente.

**Rationale**: A LaunchBox usa nomes verbosos ("Sega Mega Drive") enquanto o usuário pode ter cadastrado "Sega Genesis". O mapa de aliases resolve a ambiguidade sem intervenção manual.

### D12: Progresso de download via IPC push

**Decisão**: `downloadImages()` emite eventos `launchbox:progress` via `mainWindow.webContents.send(...)` a cada imagem baixada. O renderer escuta com `ipcRenderer.on('launchbox:progress', callback)` exposto no preload como `launchbox.onProgress(cb)`.

**Formato do evento**:
```typescript
{ current: number, total: number, filename: string, status: 'downloading' | 'skipped' | 'done' | 'error' }
```

**Rationale**: Downloads de imagens são operações lentas e múltiplas — feedback em tempo real é essencial para UX. `invoke/handle` não suporta streaming; `send/on` é o padrão correto para eventos de progresso no Electron.

### D13: importGame — fluxo completo em um IPC

**Decisão**: O handler `launchbox:importGame` recebe `{ launchboxGameId, platformId, imageTypes[] }` e executa: busca jogo no índice → chama `downloadImages` → cria/atualiza registro no SQLite com metadados + `box_art_path` apontando para a primeira "Box - Front" baixada.

**Rationale**: Agrupa a sequência completa em uma única transação do ponto de vista do renderer, simplificando o estado no frontend (sem coordenar múltiplas chamadas).

## Risks / Trade-offs

- **[Risco] better-sqlite3 requer rebuild nativo para cada versão do Electron** → Mitigação: usar `electron-rebuild` no postinstall; fixar versão do Electron no package.json.
- **[Risco] Vite + Electron dev setup frágil** → Mitigação: usar `wait-on` para esperar o Vite subir antes de lançar o Electron; electron-reload para reload automático do main.
- **[Risco] Metadata.zip de 200 MB** → Download lento na primeira vez. Mitigação: mostrar progresso em barra de progresso no renderer; permitir "Atualizar apenas se necessário" (cache de 24h já implementado no db.ts).
- **[Risco] react-window e React 19** → Verificar compatibilidade; alternativa é `@tanstack/react-virtual` se houver incompatibilidade.
- **[Trade-off] Schema flat sem ORM** → Mais SQL manual, mas total controle sobre queries e sem overhead de ORM em ambiente desktop.

## Open Questions

- Q1: Tamanho padrão dos cards na grade? (proposta: 150×200px, configurável via settings futuramente)
- Q2: Lançamento de emulador: abre o arquivo ROM com o app padrão do SO (`shell.openPath`) ou permite configurar emulador por plataforma? (MVP: `shell.openPath`)
