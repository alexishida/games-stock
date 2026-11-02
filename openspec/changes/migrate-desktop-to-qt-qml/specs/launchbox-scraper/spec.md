<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Download e cache do banco de metadados LaunchBox
O sistema SHALL baixar `Metadata.zip` de `https://gamesdb.launchbox-app.com/Metadata.zip` e extrair `Metadata.xml` para `<data-dir>/launchbox_cache/`. O download SHALL ocorrer apenas se o cache tiver mais de 24 horas ou se for explicitamente forçado.

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
- **THEN** a interface recebe eventos `launchbox:progress` com `{ current, total, status: 'downloading' }`

### Requirement: Construção e cache do índice de jogos
O sistema SHALL parsear `Metadata.xml` com processamento XML nativo e construir um índice em memória de todos os jogos. O índice SHALL ser persistido em `<data-dir>/launchbox_cache/index.json` para evitar reparse entre sessões.

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

### Requirement: Download de imagens por tipo
O sistema SHALL baixar imagens da LaunchBox a partir do CDN `https://images.launchbox-app.com/<filename>`. As imagens SHALL ser salvas em `<data-dir>/images/<platform>/<game>/`. Imagens existentes SHALL ser puladas.

Os nomes de arquivo SHALL seguir o padrão: para tipos "Box -" → `{slug(type)}-{slug(region)}-{index_padded}.ext`; para demais tipos → `{slug(type)}-{slug(region)}.ext`. Após o download, um arquivo `metadata.json` com os dados do jogo é sempre gravado no diretório.

#### Scenario: Download de tipos específicos
- **WHEN** `launchbox:downloadImages` é chamado com tipos selecionados
- **THEN** baixa apenas imagens dos tipos solicitados e retorna `{ success, skipped, failed, files }`

#### Scenario: Imagem já existente
- **WHEN** o arquivo de imagem já existe no diretório de destino
- **THEN** o download é pulado e contabilizado em `skipped`

#### Scenario: Progresso por imagem
- **WHEN** cada imagem é baixada
- **THEN** a interface recebe `launchbox:progress` com `{ current, total, filename, status }`

### Requirement: Geração de preview de capa (cover.jpg)
Após cada download, o sistema SHALL gerar um `cover.jpg` no diretório do jogo a partir da melhor imagem "Box - Front" disponível, usando processamento nativo de imagens. A imagem de origem SHALL ser selecionada por prioridade de região: brazil → north-america → europe → world → united-states → no_region → primeiro arquivo. O tamanho SHALL ser 195×280 para capas portrait ou 280×195 para capas landscape, com `fit: inside`, sem ampliação e qualidade JPEG 85. O `cover.jpg` gerado SHALL ser incluído no início do array `files` retornado.

#### Scenario: Capa portrait gerada
- **WHEN** o download inclui ao menos uma imagem "Box - Front" com altura maior que largura
- **THEN** `cover.jpg` é gerado com dimensões máximas 195×280 e adicionado em `files[0]`

#### Scenario: Capa landscape gerada
- **WHEN** a imagem "Box - Front" selecionada tem largura maior que altura
- **THEN** `cover.jpg` é gerado com dimensões máximas 280×195

#### Scenario: Sem Box - Front disponível
- **WHEN** nenhuma imagem "Box - Front" foi baixada
- **THEN** `cover.jpg` não é gerado e `files` não é alterado

### Requirement: UI de importação LaunchBox (LaunchBoxImporter)
O sistema SHALL fornecer um modal de importação acessível pela ação de navegação para importar metadados e pelo botão "Metadados" no GameDetail, com busca, filtro de plataforma por `platformKey`, lista de resultados, seleção de tipos de imagem e barra de progresso.

#### Scenario: Abrir importador
- **WHEN** a ação de navegação para importar metadados é acionada ou o usuário clica em "Metadados" no GameDetail
- **THEN** o modal LaunchBoxImporter é exibido e inicia download de metadata automaticamente se necessário

#### Scenario: Selecionar e importar jogo
- **WHEN** o usuário seleciona um jogo nos resultados, escolhe tipos de imagem e clica em "Importar"
- **THEN** a barra de progresso exibe cada download e o jogo aparece na biblioteca ao concluir

#### Scenario: Importar múltiplos jogos
- **WHEN** o usuário importa um jogo e o modal permanece aberto
- **THEN** pode buscar e importar outro jogo sem fechar o modal


