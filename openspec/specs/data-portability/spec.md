# data-portability Specification

## Purpose
Exportar e importar dados do GameStock em pacote local versionado, com selecao por categorias e restauracao segura no ambiente atual.

## Requirements
### Requirement: Exportacao seletiva por categoria

O sistema SHALL permitir exportar as categorias `metadata`, `images`, `platforms`, `romLocations` e `inventoryImages` de forma independente.

#### Scenario: Exportar subconjunto de categorias

- **WHEN** o usuario inicia exportacao com apenas algumas categorias marcadas
- **THEN** o pacote gerado contem somente os dados correspondentes

#### Scenario: Bloquear exportacao vazia

- **WHEN** nenhuma categoria e selecionada
- **THEN** a UI impede a exportacao e informa que ao menos uma categoria deve ser marcada

### Requirement: Formato do pacote versionado

O sistema SHALL gerar um arquivo `.gamestock-backup` com `manifest.json`, payloads estruturados em `data/`, arquivos de biblioteca em `media/` e arquivos do inventario em `inventory-media/` quando aplicavel.

#### Scenario: Manifesto preenchido

- **WHEN** a exportacao conclui
- **THEN** o manifesto registra `schemaVersion`, `appVersion`, `createdAt`, categorias incluidas e contagens por entidade

### Requirement: Categoria metadata

A categoria `metadata` SHALL transportar apenas metadados de jogos, incluindo `launchbox_id`, favorito, status, notas e `launch_count`, sem copiar arquivos de imagem nem `rom_path`.

#### Scenario: Exportar apenas metadata

- **WHEN** o usuario exporta somente `metadata`
- **THEN** os jogos no pacote nao incluem `box_art_path`, `background_path`, `screenshot_path` nem `rom_path`

#### Scenario: Importar metadata

- **WHEN** a categoria `metadata` e importada
- **THEN** os jogos sao criados ou atualizados por `launchbox_id + platformName`, com fallback em `title + platformName`

### Requirement: Categoria images

A categoria `images` SHALL copiar a arvore `images/` do app preservando hierarquia, nomes e referencias dos jogos.

#### Scenario: Imagem referenciada ausente

- **WHEN** um jogo aponta para imagem inexistente no disco durante a exportacao
- **THEN** o pacote segue com os demais arquivos e adiciona aviso no resumo

#### Scenario: Importar imagens da biblioteca

- **WHEN** o usuario importa `images`
- **THEN** os arquivos sao restaurados no diretorio local de imagens e os caminhos dos jogos correspondentes sao atualizados

### Requirement: Categoria platforms

A categoria `platforms` SHALL incluir plataformas, aliases LaunchBox, extensoes de ROM, emuladores e vinculos plataforma-emulador, incluindo `core_path` quando configurado.

#### Scenario: Importar plataformas e emuladores

- **WHEN** o usuario importa `platforms`
- **THEN** plataformas ausentes sao criadas por nome case-insensitive e os mapeamentos/emuladores sao reconciliados no banco local

### Requirement: Categoria romLocations

A categoria `romLocations` SHALL incluir `rom_path` dos jogos e as entradas persistidas do importador de pastas, incluindo `includeSubfolders`.

#### Scenario: Exportar localizacoes sem copiar ROMs

- **WHEN** o usuario exporta `romLocations`
- **THEN** o pacote salva somente caminhos e configuracoes de pastas, sem embutir os arquivos ROM

#### Scenario: Importar localizacoes

- **WHEN** o usuario importa `romLocations`
- **THEN** os `rom_path` sao restaurados nos jogos correspondentes e as entradas de pastas retornam ao renderer para persistencia de estado

### Requirement: Categoria inventoryImages

A categoria `inventoryImages` SHALL cobrir os metadados do inventario de hardware e as fotos fisicas armazenadas em `inventario/images/`.

#### Scenario: Exportar inventario

- **WHEN** o usuario seleciona `inventoryImages`
- **THEN** o pacote inclui itens, tipos, estados, fotos cadastradas e arquivos em `inventory-media/`

#### Scenario: Importar inventario

- **WHEN** o usuario importa `inventoryImages`
- **THEN** os itens sao reconciliados por chave estavel baseada em nome e plataforma, e as fotos sao regravadas no diretorio local do inventario

### Requirement: Preview e validacao de importacao

O sistema SHALL validar o pacote antes de importar e retornar preview com categorias disponiveis, contagens, avisos, erros e conflitos esperados.

#### Scenario: Pacote valido

- **WHEN** o usuario seleciona um pacote compativel
- **THEN** a API retorna preview detalhado antes da confirmacao final

#### Scenario: Pacote invalido

- **WHEN** o pacote nao tem manifesto valido ou usa `schemaVersion` nao suportado
- **THEN** a importacao e bloqueada sem alterar dados locais

### Requirement: Importacao transacional e segura

O sistema SHALL aplicar as escritas do SQLite em transacao e tambem limpar arquivos copiados durante a importacao caso ocorra falha no meio do processo.

#### Scenario: Importacao bem-sucedida

- **WHEN** o usuario confirma uma importacao valida
- **THEN** o sistema retorna resumo com criados, atualizados, ignorados e avisos

#### Scenario: Falha durante importacao

- **WHEN** ocorre erro ao gravar dados ou restaurar arquivos
- **THEN** a transacao e revertida, os arquivos copiados nesta tentativa sao limpos e a base local permanece consistente

### Requirement: Jobs em background com progresso

O sistema SHALL executar exportacao e importacao em background, emitindo eventos de progresso e conclusao por IPC para o renderer.

#### Scenario: Job de portabilidade em andamento

- **WHEN** uma exportacao ou importacao esta rodando
- **THEN** o NotificationCenter exibe card com etapa atual, barra de progresso e status final

#### Scenario: Job interrompido entre sessoes

- **WHEN** o app reinicia e encontra job persistido com `status: "running"`
- **THEN** esse job e reclassificado como `interrupted`
