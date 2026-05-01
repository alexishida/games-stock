# launchbox-scraper - Especificação

## Purpose
Define a integração com a base pública da LaunchBox para baixar metadados, construir índice local, buscar jogos, baixar imagens e importar registros para a biblioteca.

## Requirements
### Requirement: Download e cache do banco de metadados LaunchBox
O sistema SHALL baixar `Metadata.zip` de `https://gamesdb.launchbox-app.com/Metadata.zip` e extrair `Metadata.xml` para `%APPDATA%/GameStock/launchbox_cache/`. O download SHALL ocorrer apenas se o cache tiver mais de 24 horas ou se for explicitamente solicitado.

#### Scenario: Primeiro uso sem cache
- **WHEN** `launchbox.ensureMetadata()` é chamado sem cache local
- **THEN** o sistema baixa `Metadata.zip`, extrai `Metadata.xml` e retorna `{ status: 'downloaded' }`

#### Scenario: Cache recente
- **WHEN** `launchbox.ensureMetadata()` é chamado e o cache tem menos de 24 horas
- **THEN** nenhum download ocorre e retorna `{ status: 'cached' }`

#### Scenario: Forçar atualização
- **WHEN** `launchbox.ensureMetadata({ force: true })` é chamado
- **THEN** o `Metadata.zip` é baixado independentemente da idade do cache

#### Scenario: Progresso de download
- **WHEN** o download está em andamento
- **THEN** o renderer recebe eventos `launchbox:progress` com `{ current, total, status: 'downloading' }`

### Requirement: Construção e cache do índice de jogos
O sistema SHALL parsear `Metadata.xml` com `xml2js` e construir um índice em memória de todos os jogos com metadados e imagens disponíveis. O índice SHALL ser persistido em `%APPDATA%/GameStock/launchbox_cache/index.json`.

#### Scenario: Construir índice do XML
- **WHEN** `buildIndex()` é chamado após metadata disponível
- **THEN** retorna objeto indexado por game ID com `id`, `name`, `platform`, `release`, `developer`, `publisher`, `genres`, `overview`, `players`, `rating`, `cooperative` e `images[]`

#### Scenario: Cada imagem no índice
- **WHEN** o índice é construído
- **THEN** cada imagem contém `filename`, `type` e `region`

#### Scenario: Cache do índice em disco
- **WHEN** o índice é construído com sucesso
- **THEN** ele é salvo em `index.json` e recarregado em sessões posteriores sem reparse do XML

### Requirement: Busca de jogos no índice LaunchBox
O sistema SHALL permitir busca por nome no índice LaunchBox, com filtragem opcional por plataforma. A busca SHALL ser case-insensitive e por correspondência parcial.

#### Scenario: Busca por nome
- **WHEN** `launchbox.searchGames({ query: "batman", platformKey: null })` é chamado
- **THEN** retorna jogos cujo `name` contém "batman", ordenados por nome

#### Scenario: Busca com filtro de plataforma
- **WHEN** `launchbox.searchGames({ query: "sonic", platformKey: "megadrive" })` é chamado
- **THEN** retorna apenas jogos da plataforma Sega Mega Drive/Genesis que contêm "sonic" no nome

#### Scenario: Busca sem resultados
- **WHEN** a query não corresponde a nenhum jogo
- **THEN** retorna array vazio

### Requirement: Download de imagens por tipo
O sistema SHALL baixar imagens da LaunchBox a partir do CDN `https://images.launchbox-app.com/<filename>`. As imagens SHALL ser salvas em `%APPDATA%/GameStock/images/<platform>/<game>/`. Imagens existentes SHALL ser puladas.

#### Scenario: Download de tipos específicos
- **WHEN** `launchbox.downloadImages({ game, types: ["Box - Front", "Fanart - Background"] })` é chamado
- **THEN** baixa apenas imagens dos tipos solicitados e retorna `{ success, skipped, failed, files }`

#### Scenario: Download de todos os tipos
- **WHEN** `launchbox.downloadImages({ game, types: [] })` é chamado
- **THEN** baixa todas as imagens disponíveis para o jogo

#### Scenario: Imagem já existente
- **WHEN** o arquivo de imagem já existe no diretório de destino
- **THEN** o download é pulado e contabilizado em `skipped`

#### Scenario: Progresso por imagem
- **WHEN** cada imagem é baixada
- **THEN** o renderer recebe `launchbox:progress` com `{ current, total, filename, status }`

### Requirement: Importação completa de jogo
O sistema SHALL oferecer uma operação de importação que busca o jogo pelo ID LaunchBox, baixa imagens selecionadas e cria ou atualiza o registro no SQLite com metadados e `box_art_path`.

#### Scenario: Importar jogo novo
- **WHEN** `launchbox.importGame({ launchboxGameId, platformId, imageTypes })` é chamado para um jogo inexistente
- **THEN** um novo registro é criado em `games` com metadados LaunchBox e capa local

#### Scenario: Atualizar jogo existente
- **WHEN** `launchbox.importGame({ launchboxGameId, platformId, imageTypes })` é chamado para jogo existente
- **THEN** o registro é atualizado e `launchbox_id` é salvo

#### Scenario: Box art atribuída automaticamente
- **WHEN** a importação conclui com pelo menos uma "Box - Front"
- **THEN** `games.box_art_path` aponta para o caminho local da primeira capa baixada

### Requirement: UI de importação LaunchBox
O sistema SHALL fornecer um modal de importação acessível pelo menu FERRAMENTAS -> Importar do LaunchBox, com busca, filtro de plataforma, resultados, seleção de tipos de imagem e progresso.

#### Scenario: Abrir importador
- **WHEN** o usuário clica em FERRAMENTAS -> Importar do LaunchBox
- **THEN** o modal de importação é exibido e inicia metadata automaticamente se necessário

#### Scenario: Selecionar e importar jogo
- **WHEN** o usuário seleciona um jogo, escolhe tipos de imagem e clica em "Importar"
- **THEN** a barra de progresso exibe cada download e o jogo aparece na biblioteca ao concluir

#### Scenario: Importar múltiplos jogos
- **WHEN** o usuário importa um jogo e o modal permanece aberto
- **THEN** pode buscar e importar outro jogo sem fechar o modal

### Requirement: Correspondência em lote por título e plataforma
O sistema SHALL fornecer uma operação de correspondência em lote que recebe candidatos de título de ROM e uma plataforma selecionada, retornando o melhor match LaunchBox disponível.

#### Scenario: Match exato por título normalizado
- **WHEN** um candidato de ROM corresponde exatamente ao nome LaunchBox normalizado na plataforma selecionada
- **THEN** o matcher retorna esse jogo LaunchBox como match selecionado

#### Scenario: Sem match de plataforma
- **WHEN** um candidato existe na LaunchBox apenas em outra plataforma
- **THEN** o matcher não seleciona esse jogo para o candidato atual

#### Scenario: Alias curto de plataforma não casa por substring
- **WHEN** a plataforma selecionada é "NES" e também existe jogo semelhante para "Sega Genesis"
- **THEN** o matcher MUST NOT tratar "Genesis" como match para "NES"

#### Scenario: Match ambíguo
- **WHEN** múltiplos jogos LaunchBox são plausíveis e nenhum melhor match confiável pode ser escolhido
- **THEN** o candidato é marcado como sem correspondência ou ambíguo sem bloquear o restante do lote

#### Scenario: Reutilizar índice em lotes grandes
- **WHEN** uma pasta contém centenas de candidatos para a mesma plataforma
- **THEN** o sistema constrói o contexto filtrado por plataforma uma vez e reutiliza os títulos normalizados

### Requirement: Download do conjunto padrão de mídia para importação por pasta
O sistema SHALL baixar para cada jogo encontrado os tipos "Box - Front", "Fanart - Background" e "Screenshot - Gameplay".

#### Scenario: Baixar tipos padrão
- **WHEN** um candidato de lote tem match LaunchBox
- **THEN** o sistema baixa as imagens disponíveis dos tipos padrão

#### Scenario: Reutilizar mídia já baixada
- **WHEN** uma imagem solicitada já existe localmente
- **THEN** o sistema pula o download e reporta como `skipped`

#### Scenario: Disponibilidade parcial de mídia
- **WHEN** apenas parte dos tipos padrão está disponível
- **THEN** o sistema baixa os arquivos disponíveis e reporta mídia ausente sem falhar a importação do jogo
