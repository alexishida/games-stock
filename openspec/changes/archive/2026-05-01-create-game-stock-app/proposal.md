## Why

Colecionadores e entusiastas de retrogames precisam de uma ferramenta centralizada para gerenciar tanto suas ROMs digitais quanto seu inventário físico de cartuchos e discos — hoje essa gestão é feita em planilhas ou memória. O GameStock resolve isso com uma interface estilo LaunchBox, focada em coleção, box art e rastreamento físico.

## What Changes

- Criação do projeto do zero: aplicativo Electron 41 + React 19 + TypeScript 5 + Vite 7
- Banco de dados SQLite local via better-sqlite3 para persistência de jogos, plataformas e inventário
- Interface principal com grade de box arts, painel de plataformas e barra de menu
- Sistema de gerenciamento de ROMs: associar caminhos de arquivo a jogos
- Inventário físico: flag `owned_physical` por jogo com rastreamento de condição
- Filtros hierárquicos por categoria → plataforma com contagem de jogos
- Busca textual por nome de jogo
- Visualização em grade (padrão) e lista
- **Importador LaunchBox**: download automático de metadados e imagens (box art, screenshot, background, etc.) via adaptação do projeto `launchbox-downloader` já existente — sem API key, usando CDN público da LaunchBox
- Build pipeline: tsc para main/preload, vite build para renderer, electron-builder para distribuição Windows

## Capabilities

### New Capabilities

- `app-shell`: Estrutura Electron com janela principal, menu nativo, processo main/preload/renderer e bridge IPC segura
- `game-library`: CRUD de jogos com metadados (nome, plataforma, publisher, ano, gênero, rating, box art path, rom path)
- `platform-manager`: Gerenciamento de plataformas com hierarquia categoria → plataforma e contagem de jogos
- `physical-inventory`: Controle de inventário físico com flag de posse e condição do item
- `library-ui`: Interface principal com grade de capas, painel lateral de plataformas, busca e filtros
- `rom-association`: Associação de arquivos ROM a jogos via seletor de arquivo nativo
- `launchbox-scraper`: Download de metadados e imagens dos jogos a partir da base pública da LaunchBox (Metadata.zip + CDN de imagens), adaptado do projeto `launchbox-downloader` para TypeScript/Electron com progresso via IPC

### Modified Capabilities

## Impact

- **Novo projeto**: sem código preexistente, tudo será criado do zero
- **Dependências principais**: electron@^41, react@^19, typescript@^5, vite@^7, better-sqlite3, electron-builder, concurrently, adm-zip, xml2js (herdados do launchbox-downloader; `node-fetch` substituído por `fetch` nativo do Node 18+)
- **Plataforma alvo**: Windows 11 (distribuição via electron-builder NSIS/portable)
- **Armazenamento**: SQLite local em `%APPDATA%/GameStock/gamestock.db`
- **Assets**: box arts armazenadas em `%APPDATA%/GameStock/images/`
