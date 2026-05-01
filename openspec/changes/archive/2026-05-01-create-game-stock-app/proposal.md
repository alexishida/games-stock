## Por Que

Colecionadores e entusiastas de retrogames precisavam de uma ferramenta centralizada para gerenciar ROMs digitais e inventário físico. O GameStock foi criado como um app desktop inspirado no LaunchBox, com biblioteca visual, box arts, plataformas e controle de coleção.

## O Que Muda

- Criação do app Electron + React + TypeScript + Vite.
- Banco SQLite local com `better-sqlite3`.
- UI principal com grade/lista, painel lateral, busca e menus.
- CRUD de jogos e plataformas.
- Associação de ROMs e importação de box art.
- Inventário físico por jogo.
- Importador LaunchBox com metadados e imagens.
- Build para Windows via Electron Builder.

## Capacidades

### Novas Capacidades

- `app-shell`
- `game-library`
- `platform-manager`
- `physical-inventory`
- `library-ui`
- `rom-association`
- `launchbox-scraper`

### Capacidades Modificadas

Nenhuma. Esta mudança criou a base inicial do projeto.

## Impacto

- Novo projeto criado do zero.
- Persistência em `%APPDATA%/GameStock/gamestock.db`.
- Imagens locais em `%APPDATA%/GameStock/images/`.
- Integração com metadados públicos da LaunchBox.
