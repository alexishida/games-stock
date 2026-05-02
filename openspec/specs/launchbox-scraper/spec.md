# launchbox-scraper - Especificação

## Purpose
Define a integração com a base pública da LaunchBox para baixar metadados, construir índice local, buscar jogos, baixar imagens e importar registros para a biblioteca — tanto individualmente via modal quanto em lote via importação por pasta de ROMs.

## Requirements
### Requirement: Download e cache do banco de metadados LaunchBox
O sistema SHALL baixar `Metadata.zip` de `https://gamesdb.launchbox-app.com/Metadata.zip` e extrair `Metadata.xml` para `%APPDATA%/GameStock/launchbox_cache/`. O download SHALL ocorrer apenas se o cache tiver mais de 24 horas ou se for explicitamente forçado.

#### Scenario: Primeiro uso sem cache
- **WHEN** `launchbox:ensureMetadata` é chamado sem cache local
- **THEN** o sistema baixa `Metadata.zip`, extrai `Metadata.xml` e retorna `{ status: 'downloaded' }`

#### Scenario: Cache recente
- **WHEN** `launchbox:ensureMetadata` é chamado e o cache tem menos de 24 horas
- **THEN** nenhum download ocorre e retorna `{ status: 'cached' }`

#### Scenario: Forçar atualização
- **WHEN** `launchbox:ensureMetadata` é chamado com `force: true`
- **THEN** o `Metadata.zip` é baixado independentemente da idade do cache

#### Scenario: Progresso de download
- **WHEN** o download está em andamento
- **THEN** o renderer recebe eventos `launchbox:progress` com `{ current, total, status: 'downloading' }`

### Requirement: Construção e cache do índice de jogos
O sistema SHALL parsear `Metadata.xml` com `xml2js` e construir um índice em memória de todos os jogos. O índice SHALL ser persistido em `%APPDATA%/GameStock/launchbox_cache/index.json` para evitar reparse entre sessões.

#### Scenario: Construir índice do XML
- **WHEN** `buildIndex()` é chamado após metadata disponível
- **THEN** retorna objeto indexado por game ID com `id`, `name`, `platform`, `release`, `developer`, `publisher`, `genres`, `overview`, `players`, `rating`, `cooperative` e `images[]`

#### Scenario: Cada imagem no índice
- **WHEN** o índice é construído
- **THEN** cada imagem contém `filename`, `type` e `region`

#### Scenario: Cache do índice em disco
- **WHEN** o índice é construído com sucesso
- **THEN** ele é salvo em `index.json` e recarregado em sessões posteriores sem reparse do XML

#### Scenario: Cache em memória
- **WHEN** o índice já foi carregado na sessão atual
- **THEN** `buildIndex()` reutiliza o índice em memória sem ler disco novamente

### Requirement: Busca de jogos no índice LaunchBox
O sistema SHALL permitir busca por nome no índice LaunchBox, com filtragem opcional por plataforma via `platformKey`. A busca SHALL ser case-insensitive, por correspondência parcial e limitada a 100 resultados.

#### Scenario: Busca por nome
- **WHEN** `launchbox:searchGames` é chamado com `{ query: "batman", platformKey: null }`
- **THEN** retorna até 100 jogos cujo `name` contém "batman", ordenados por nome

#### Scenario: Busca com filtro de plataforma
- **WHEN** `launchbox:searchGames` é chamado com `{ query: "sonic", platformKey: "megadrive" }`
- **THEN** retorna apenas jogos da plataforma Sega Mega Drive/Genesis que contêm "sonic" no nome

#### Scenario: Busca sem resultados
- **WHEN** a query não corresponde a nenhum jogo
- **THEN** retorna array vazio

### Requirement: Plataformas suportadas com aliases
O sistema SHALL manter um mapeamento interno de `platformKey` para os nomes de plataforma usados na LaunchBox, incluindo pelo menos: `megadrive`, `snes`, `n64`, `nes`, `gb`, `gba`, `gbc`, `saturn`, `psx`, `ps2`, `dreamcast`, `gg`, `sms`, `32x`, `tgfx16`, `msx`, `arcade`.

#### Scenario: Filtrar por platformKey
- **WHEN** `platformKey: "snes"` é usado na busca
- **THEN** apenas jogos cujo `platform` no índice inclua "Super Nintendo" são retornados

### Requirement: Download de imagens por tipo
O sistema SHALL baixar imagens da LaunchBox a partir do CDN `https://images.launchbox-app.com/<filename>`. As imagens SHALL ser salvas em `%APPDATA%/GameStock/images/<platform>/<game>/`. Imagens existentes SHALL ser puladas.

#### Scenario: Download de tipos específicos
- **WHEN** `launchbox:downloadImages` é chamado com tipos selecionados
- **THEN** baixa apenas imagens dos tipos solicitados e retorna `{ success, skipped, failed, files }`

#### Scenario: Imagem já existente
- **WHEN** o arquivo de imagem já existe no diretório de destino
- **THEN** o download é pulado e contabilizado em `skipped`

#### Scenario: Progresso por imagem
- **WHEN** cada imagem é baixada
- **THEN** o renderer recebe `launchbox:progress` com `{ current, total, filename, status }`

### Requirement: Importação completa de jogo individual
O sistema SHALL oferecer `launchbox:importGame` que busca o jogo pelo ID LaunchBox, baixa imagens selecionadas e cria ou atualiza o registro no SQLite com metadados e `box_art_path`.

#### Scenario: Importar jogo novo
- **WHEN** `launchbox:importGame` é chamado para um jogo sem correspondência no banco
- **THEN** um novo registro é criado em `games` com metadados LaunchBox, `launchbox_id` preenchido e `box_art_path` apontando para a primeira "Box - Front" baixada

#### Scenario: Atualizar jogo existente
- **WHEN** `launchbox:importGame` é chamado para jogo já existente (mesmo `launchbox_id` e plataforma)
- **THEN** o registro é atualizado com os novos metadados e imagens

#### Scenario: Plataforma resolvida automaticamente
- **WHEN** `platformId` não é fornecido na chamada
- **THEN** o sistema mapeia a plataforma LaunchBox para uma plataforma existente no banco ou cria uma nova

### Requirement: UI de importação LaunchBox (LaunchBoxImporter)
O sistema SHALL fornecer um modal de importação acessível pelo canal `launchbox:openImporter` e pelo botão "Metadados" no GameDetail, com busca, filtro de plataforma por `platformKey`, lista de resultados, seleção de tipos de imagem e barra de progresso.

#### Scenario: Abrir importador
- **WHEN** o canal `launchbox:openImporter` é recebido ou o usuário clica em "Metadados" no GameDetail
- **THEN** o modal LaunchBoxImporter é exibido e inicia download de metadata automaticamente se necessário

#### Scenario: Selecionar e importar jogo
- **WHEN** o usuário seleciona um jogo nos resultados, escolhe tipos de imagem e clica em "Importar"
- **THEN** a barra de progresso exibe cada download e o jogo aparece na biblioteca ao concluir

#### Scenario: Importar múltiplos jogos
- **WHEN** o usuário importa um jogo e o modal permanece aberto
- **THEN** pode buscar e importar outro jogo sem fechar o modal

### Requirement: Correspondência em lote por título e plataforma
O sistema SHALL fornecer lógica de match que recebe candidatos de título de ROM e uma plataforma selecionada, retornando o melhor match LaunchBox com base em score de similaridade. O threshold de match SHALL ser 0.72.

#### Scenario: Match exato por título normalizado
- **WHEN** o título normalizado do candidato corresponde exatamente ao nome LaunchBox normalizado na plataforma selecionada
- **THEN** o score é 1.0 e o candidato é marcado como "matched"

#### Scenario: Match por substring
- **WHEN** um dos títulos contém o outro após normalização
- **THEN** o score é 0.86 e o candidato é marcado como "matched" se não houver ambiguidade

#### Scenario: Match por sobreposição de tokens
- **WHEN** títulos compartilham tokens comuns após normalização
- **THEN** o score é calculado como overlap/max(tokens) e o candidato é matched apenas se score >= 0.72

#### Scenario: Ambiguidade de match
- **WHEN** múltiplos jogos LaunchBox atingem o mesmo score máximo
- **THEN** o candidato é marcado como "ambiguous" e nenhum jogo é criado

#### Scenario: Sem match
- **WHEN** nenhum jogo LaunchBox atinge score >= 0.72 para a plataforma selecionada
- **THEN** o candidato é marcado como "unmatched" e incluído no resumo sem criar registro

#### Scenario: Reutilizar contexto em lotes grandes
- **WHEN** uma pasta contém centenas de candidatos para a mesma plataforma
- **THEN** o sistema constrói o contexto filtrado por plataforma uma vez e reutiliza para todos os candidatos do lote

### Requirement: Download do conjunto padrão de mídia para importação por pasta
O sistema SHALL baixar para cada jogo com match os tipos "Box - Front", "Cart - Front", "Fanart - Background" e "Screenshot - Gameplay".

#### Scenario: Baixar tipos padrão
- **WHEN** um candidato de lote tem match LaunchBox
- **THEN** o sistema baixa as imagens disponíveis dos quatro tipos padrão

#### Scenario: Reutilizar mídia já baixada
- **WHEN** uma imagem solicitada já existe localmente
- **THEN** o sistema pula o download e reporta como `skipped`

#### Scenario: Disponibilidade parcial de mídia
- **WHEN** apenas parte dos tipos padrão está disponível para um jogo
- **THEN** o sistema baixa os arquivos disponíveis e reporta mídia ausente sem falhar a importação
