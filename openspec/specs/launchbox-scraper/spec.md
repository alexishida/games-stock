# launchbox-scraper Specification

## Purpose
TBD - created by archiving change create-game-stock-app. Update Purpose after archive.
## Requirements
### Requirement: Download e cache do banco de metadados LaunchBox
O sistema SHALL baixar o arquivo `Metadata.zip` de `https://gamesdb.launchbox-app.com/Metadata.zip` e extrair o `Metadata.xml` para `%APPDATA%/GameStock/launchbox_cache/`. O download SHALL ocorrer apenas se o cache tiver mais de 24 horas ou se explicitamente solicitado. O progresso do download SHALL ser reportado ao renderer via IPC push (`launchbox:progress`).

#### Scenario: Primeiro uso sem cache
- **WHEN** `launchbox.ensureMetadata()` é chamado sem cache local
- **THEN** o sistema baixa Metadata.zip, extrai Metadata.xml para o diretório de cache e retorna `{ status: 'downloaded' }`

#### Scenario: Cache recente (< 24h)
- **WHEN** `launchbox.ensureMetadata()` é chamado e o cache tem menos de 24 horas
- **THEN** nenhum download ocorre e retorna `{ status: 'cached' }`

#### Scenario: Forçar atualização
- **WHEN** `launchbox.ensureMetadata({ force: true })` é chamado
- **THEN** o Metadata.zip é baixado independentemente da idade do cache

#### Scenario: Progresso de download
- **WHEN** o download está em andamento
- **THEN** o renderer recebe eventos `launchbox:progress` com `{ current: bytes, total: bytes, status: 'downloading' }`

### Requirement: Construção e cache do índice de jogos
O sistema SHALL parsear o `Metadata.xml` com `xml2js` e construir um índice em memória de todos os jogos com seus metadados e imagens disponíveis. O índice SHALL ser persistido em `%APPDATA%/GameStock/launchbox_cache/index.json` para evitar reparse entre sessões. O índice SHALL ser mantido como singleton no processo main.

#### Scenario: Construir índice do XML
- **WHEN** `buildIndex()` é chamado após metadata disponível
- **THEN** retorna objeto indexado por game ID, cada entrada contendo: `id`, `name`, `platform`, `release`, `developer`, `publisher`, `genres`, `overview`, `players`, `rating`, `cooperative`, `images[]`

#### Scenario: Cada imagem no índice
- **WHEN** o índice é construído
- **THEN** cada entrada de imagem contém: `filename` (caminho CDN), `type` (ex: "Box - Front"), `region` (ex: "NA", pode ser null)

#### Scenario: Cache do índice em disco
- **WHEN** o índice é construído com sucesso
- **THEN** é salvo em `index.json` e recarregado deste arquivo em sessões posteriores sem reparse do XML

### Requirement: Busca de jogos no índice LaunchBox
O sistema SHALL permitir busca por nome de jogo no índice LaunchBox, com filtragem opcional por plataforma. A busca SHALL ser case-insensitive e por correspondência parcial. Os resultados SHALL ser retornados ordenados por nome.

#### Scenario: Busca por nome
- **WHEN** `launchbox.searchGames({ query: "batman", platformKey: null })` é chamado
- **THEN** retorna array de jogos do índice cujo `name` contém "batman" (case-insensitive), ordenados por nome

#### Scenario: Busca com filtro de plataforma
- **WHEN** `launchbox.searchGames({ query: "sonic", platformKey: "megadrive" })` é chamado
- **THEN** retorna apenas jogos da plataforma Sega Mega Drive/Genesis que contêm "sonic" no nome

#### Scenario: Busca sem resultados
- **WHEN** a query não corresponde a nenhum jogo
- **THEN** retorna array vazio

### Requirement: Download de imagens por tipo
O sistema SHALL baixar imagens de um jogo da LaunchBox a partir do CDN `https://images.launchbox-app.com/<filename>`. As imagens SHALL ser salvas em `%APPDATA%/GameStock/images/<game-title>/`. Tipos suportados: "Box - Front", "Box - Back", "Box - Spine", "Screenshot - Gameplay", "Fanart - Background", "Banner", "Clear Logo", "Disc", "Cart - Front", "Screenshot - Game Title". Imagens já existentes SHALL ser puladas.

#### Scenario: Download de tipos específicos
- **WHEN** `launchbox.downloadImages({ game, types: ["Box - Front", "Fanart - Background"] })` é chamado
- **THEN** baixa apenas imagens dos tipos solicitados e retorna `{ success: number, skipped: number, failed: number, files: string[] }`

#### Scenario: Download de todos os tipos
- **WHEN** `launchbox.downloadImages({ game, types: [] })` é chamado com array vazio
- **THEN** baixa todas as imagens disponíveis para o jogo

#### Scenario: Imagem já existente
- **WHEN** o arquivo de imagem já existe no diretório de destino
- **THEN** o download é pulado e contabilizado em `skipped`

#### Scenario: Progresso por imagem
- **WHEN** cada imagem é baixada
- **THEN** o renderer recebe `launchbox:progress` com `{ current, total, filename, status: 'downloading' | 'skipped' | 'done' }`

### Requirement: Importação completa de jogo (metadata + imagens → SQLite)
O sistema SHALL oferecer uma operação atômica de importação que: busca o jogo pelo ID LaunchBox, baixa as imagens dos tipos selecionados, e cria ou atualiza o registro no banco SQLite com todos os metadados disponíveis e o `box_art_path` apontando para a primeira "Box - Front" baixada.

#### Scenario: Importar jogo novo
- **WHEN** `launchbox.importGame({ launchboxGameId, platformId, imageTypes })` é chamado para um jogo não existente no banco
- **THEN** um novo registro é criado em `games` com `title`, `publisher`, `year`, `genre`, `rating`, `box_art_path`, `platform_id` preenchidos dos dados LaunchBox; retorna o novo `game.id`

#### Scenario: Atualizar jogo existente
- **WHEN** `launchbox.importGame({ launchboxGameId, platformId, imageTypes })` é chamado para jogo já existente (match por title + platform_id)
- **THEN** o registro existente é atualizado com os novos metadados e imagens; o `launchbox_id` é salvo no banco

#### Scenario: Box art atribuída automaticamente
- **WHEN** a importação conclui com pelo menos uma "Box - Front" baixada
- **THEN** `games.box_art_path` aponta para o caminho local da primeira "Box - Front" (não para URL do CDN)

### Requirement: UI de importação LaunchBox
O sistema SHALL fornecer um modal/dialog de importação acessível via menu FERRAMENTAS → Importar do LaunchBox com: campo de busca, filtro de plataforma (dropdown com as plataformas do PLATFORMS config), lista de resultados (nome + plataforma + contagem de imagens), seleção de tipos de imagem via checkboxes e barra de progresso de download.

#### Scenario: Abrir importador
- **WHEN** o usuário clica em FERRAMENTAS → Importar do LaunchBox
- **THEN** o modal de importação é exibido; se metadata não estiver em cache, inicia download automaticamente com progresso

#### Scenario: Selecionar e importar jogo
- **WHEN** o usuário seleciona um jogo da lista, escolhe tipos de imagem e clica em "Importar"
- **THEN** a barra de progresso exibe cada imagem sendo baixada e, ao concluir, o jogo aparece na grade da biblioteca

#### Scenario: Importar múltiplos jogos
- **WHEN** o usuário importa um jogo e o modal permanece aberto
- **THEN** pode buscar e importar outro jogo sem fechar o modal

