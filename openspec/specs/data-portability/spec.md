# data-portability Specification

## Purpose
TBD - created by archiving change add-settings-data-portability. Update Purpose after archive.
## Requirements
### Requirement: Exportacao seletiva de pacote
O sistema SHALL permitir exportar um pacote local versionado com selecao independente das categorias `metadata`, `images`, `platforms` e `romLocations`.

#### Scenario: Exportar categorias selecionadas
- **WHEN** o usuario inicia exportacao com `metadata`, `images` e `romLocations` selecionados
- **THEN** o pacote gerado contem apenas metadados de jogos, arquivos/mapas de imagem e localizacoes de ROMs

#### Scenario: Bloquear exportacao sem categorias
- **WHEN** o usuario tenta exportar sem nenhuma categoria selecionada
- **THEN** o sistema bloqueia a acao e informa que ao menos uma categoria deve ser selecionada

### Requirement: Formato de pacote versionado
O sistema SHALL gerar pacote `.gamestock-backup` contendo `manifest.json`, arquivos JSON em `data/` e arquivos de midia em `media/` quando a categoria `images` estiver selecionada.

#### Scenario: Manifesto de exportacao
- **WHEN** uma exportacao e concluida
- **THEN** `manifest.json` inclui schemaVersion, appVersion, createdAt, categorias incluidas e contagens de itens exportados

#### Scenario: Pacote sem imagens
- **WHEN** a categoria `images` nao esta selecionada
- **THEN** o pacote nao contem arquivos em `media/` e nao copia imagens da pasta de dados do app

### Requirement: Metadados de jogos
O sistema SHALL exportar e importar metadados de jogos incluindo titulo, plataforma, publisher, ano, genero, rating, favorito, status de jogo, notas e `launchbox_id`, sem incluir caminhos de imagem ou `rom_path` nessa categoria.

#### Scenario: Exportar metadados sem caminhos
- **WHEN** o usuario exporta apenas `metadata`
- **THEN** os registros de jogos no pacote nao contem `box_art_path`, `background_path`, `screenshot_path` ou `rom_path`

#### Scenario: Importar metadados de jogos
- **WHEN** o usuario importa `metadata`
- **THEN** o sistema cria ou atualiza jogos usando `launchbox_id + platformName` como chave primaria de correspondencia e `title + platformName` como fallback

### Requirement: Imagens da biblioteca
O sistema SHALL exportar toda a pasta `%APPDATA%/gamestock/images` preservando hierarquia e nomes originais e, ao importar, restaurar essa mesma arvore na pasta de dados atual antes de atualizar os caminhos dos jogos referenciados.

#### Scenario: Exportar arvore completa de imagens
- **WHEN** a categoria `images` esta selecionada e existem arquivos em `%APPDATA%/gamestock/images`
- **THEN** o pacote inclui copias desses arquivos em `media/` preservando hierarquia e nomes originais, alem de um mapa das imagens referenciadas pelos jogos

#### Scenario: Imagem referenciada ausente durante exportacao
- **WHEN** um jogo referencia uma imagem que nao existe no disco
- **THEN** a exportacao continua, ainda copia os demais arquivos existentes da pasta `images` e o resumo lista a imagem ausente como aviso

#### Scenario: Importar imagens
- **WHEN** o usuario importa `images`
- **THEN** o sistema restaura os arquivos de midia em `%APPDATA%/gamestock/images` preservando hierarquia e nomes originais e atualiza os campos de imagem dos jogos correspondentes

### Requirement: Informacoes de plataformas
O sistema SHALL exportar e importar plataformas, aliases LaunchBox, extensoes de ROM, emuladores e vinculos entre plataformas e emuladores quando a categoria `platforms` estiver selecionada.

#### Scenario: Exportar plataformas completas
- **WHEN** o usuario exporta `platforms`
- **THEN** o pacote inclui plataformas, aliases, extensoes, emuladores e associacoes de emulador padrao por plataforma

#### Scenario: Importar plataformas por nome
- **WHEN** o usuario importa `platforms`
- **THEN** o sistema cria plataformas ausentes e atualiza plataformas existentes usando o nome como chave case-insensitive

### Requirement: Localizacoes de ROMs
O sistema SHALL exportar e importar `rom_path` dos jogos e entradas configuradas do importador de pastas de ROMs quando a categoria `romLocations` estiver selecionada.

#### Scenario: Exportar localizacoes sem copiar ROMs
- **WHEN** o usuario exporta `romLocations`
- **THEN** o pacote contem caminhos de ROM e entradas de pastas configuradas, mas nao contem arquivos ROM

#### Scenario: Importar localizacoes de ROMs
- **WHEN** o usuario importa `romLocations`
- **THEN** o sistema restaura `rom_path` nos jogos correspondentes e retorna as entradas de pastas para o renderer gravar em `localStorage`

#### Scenario: Caminhos inexistentes no computador atual
- **WHEN** uma localizacao importada aponta para caminho inexistente no disco atual
- **THEN** o sistema preserva o caminho e mostra aviso no preview ou resumo de importacao

### Requirement: Preview e validacao de importacao
O sistema SHALL validar o pacote e exibir preview com categorias disponiveis, contagens, avisos e conflitos antes de permitir aplicar a importacao.

#### Scenario: Previsualizar pacote valido
- **WHEN** o usuario seleciona um pacote compativel
- **THEN** o sistema retorna categorias disponiveis, contagens de jogos/plataformas/imagens/localizacoes e avisos encontrados

#### Scenario: Recusar pacote incompativel
- **WHEN** o pacote nao tem `manifest.json` valido ou usa schemaVersion nao suportado
- **THEN** o sistema bloqueia a importacao e mostra erro claro sem alterar dados locais

### Requirement: Importacao transacional
O sistema SHALL aplicar escritas no SQLite dentro de uma transacao e retornar resumo com criados, atualizados, ignorados, avisos e falhas.

#### Scenario: Importacao bem-sucedida
- **WHEN** o usuario confirma uma importacao valida
- **THEN** o sistema aplica as categorias selecionadas e retorna resumo de itens criados, atualizados e ignorados

#### Scenario: Falha durante importacao
- **WHEN** ocorre erro ao gravar dados no SQLite
- **THEN** a transacao e revertida e a biblioteca local permanece no estado anterior

### Requirement: Jobs em background com progresso
O sistema SHALL executar exportacao e importacao em worker thread do processo main, emitindo progresso e conclusao por IPC para o renderer.

#### Scenario: Exportacao em background
- **WHEN** o usuario inicia uma exportacao valida
- **THEN** o sistema retorna um job de exportacao imediatamente, executa o pacote em worker thread e emite eventos `dataPortability:progress` ate a conclusao

#### Scenario: Importacao em background
- **WHEN** o usuario confirma uma importacao valida
- **THEN** o sistema retorna um job de importacao imediatamente, executa a restauracao em worker thread e emite eventos `dataPortability:progress` e `dataPortability:completed`

#### Scenario: Notificacao de portabilidade
- **WHEN** um job de exportacao ou importacao esta rodando
- **THEN** o NotificationCenter exibe card com barra de progresso, etapa atual e status final do job
