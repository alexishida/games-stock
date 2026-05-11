# rom-folder-import - Especificacao

## Purpose
Define o assistente de importacao em lote por pastas de ROMs, com resumo de pastas configuradas, adicao/remocao de entradas, descoberta de ROMs, execucao em background e notificacoes de progresso.

## Requirements
### Requirement: Resumo de pastas configuradas (SummaryStep)
O sistema SHALL exibir na tela inicial do RomFolderImporter uma tabela com todas as pastas ja configuradas, mostrando caminho, plataforma associada, quantidade de jogos indexados e se aquela entrada inclui busca em subpastas. As entradas SHALL ser persistidas no estado de app via `window.gameStockAPI.appState` e armazenadas no SQLite local.

#### Scenario: Abrir com pastas configuradas
- **WHEN** o usuario abre o RomFolderImporter com entradas salvas
- **THEN** a tabela exibe cada entrada com `folderPath`, `platformName`, `indexedCount` e indicador de `includeSubfolders` quando ativo

#### Scenario: Abrir sem pastas configuradas
- **WHEN** nao ha entradas salvas no estado persistido do app
- **THEN** a tabela exibe estado vazio e o botao "Adicionar Pasta" esta visivel

#### Scenario: Continuar downloads de pasta existente
- **WHEN** o usuario seleciona uma linha e clica em "Continuar downloads"
- **THEN** o sistema inicia um job de importacao em background para aquela pasta usando a plataforma ja salva e fecha o overlay

### Requirement: Adicionar nova pasta de ROMs
O sistema SHALL fornecer um fluxo de dois passos (`configure` -> `review`) dentro de um overlay modal para adicionar uma nova pasta ao indice. O scan aceita uma lista de `folderPaths` (pastas inteiras) e/ou `romFilePaths` (arquivos ROM individuais).

#### Scenario: Abrir formulario de configuracao
- **WHEN** o usuario clica em "Adicionar Pasta"
- **THEN** o overlay do AddFolderPanel e exibido no passo `configure` com campo de pasta, seletor de plataforma, a primeira opcao "Deteccao automatica" e opcao para buscar ROMs em subpastas

#### Scenario: Selecionar pasta pelo browser nativo
- **WHEN** o usuario clica para selecionar pasta
- **THEN** o dialogo nativo de selecao de pasta e aberto e o caminho escolhido e preenchido no campo

#### Scenario: Avancar para revisao
- **WHEN** o usuario clica em "Proximo" com pasta e plataforma selecionadas
- **THEN** o sistema chama `romFolderImport:scan` com `includeSubfolders` de acordo com a escolha do usuario e avanca para o passo `review` com lista de candidatos encontrados

#### Scenario: Avancar com deteccao automatica
- **WHEN** o usuario clica em "Proximo" com a opcao "Deteccao automatica"
- **THEN** o sistema chama `romFolderImport:scan` com `detectionMode = automatic`, sem exigir `platformId` manual, e avanca para o passo `review`

#### Scenario: Revisao antes de importar
- **WHEN** o passo `review` e exibido
- **THEN** o assistente mostra quantidade de ROMs encontradas, arquivos ignorados, se a revisao inclui subpastas e lista de candidatos (`filename`, `titleCandidate`, `folderPath` e `platformName` quando a deteccao for automatica)

#### Scenario: Voltar para configuracao
- **WHEN** o usuario clica em "Voltar" no passo `review`
- **THEN** o assistente retorna ao passo `configure` sem perder pasta, plataforma e escolha de subpastas

#### Scenario: Pasta vazia
- **WHEN** o scan retorna zero candidatos
- **THEN** o passo `review` exibe estado vazio e nao permite iniciar a importacao

#### Scenario: Iniciar importacao em background
- **WHEN** o usuario clica em "Iniciar em background" no passo `review`
- **THEN** o sistema chama `romFolderImport:import` com o mesmo `includeSubfolders` do scan, fecha o overlay, salva a entrada persistida e inicia o job

#### Scenario: Salvar entradas detectadas automaticamente
- **WHEN** a importacao automatica encontra ROMs de mais de uma plataforma na mesma pasta
- **THEN** o sistema salva uma entrada persistida por plataforma detectada, usando a mesma `folderPath` e o `platformId` correspondente

#### Scenario: Habilitar busca em subpastas
- **WHEN** o usuario marca "Buscar ROMs em subpastas" antes do scan
- **THEN** ROMs elegiveis em diretorios filhos da pasta selecionada tambem sao incluidas na revisao e na importacao

### Requirement: Remocao de pasta configurada
O sistema SHALL permitir remover uma entrada da tabela, excluindo tambem os jogos indexados com `rom_path` dentro daquela pasta.

#### Scenario: Confirmar remocao de pasta
- **WHEN** o usuario seleciona uma linha, clica em "Deletar Pasta" e confirma
- **THEN** a entrada e removida do estado persistido e `romFolderImport:deleteFolderRecords` e chamado para remover os jogos associados

#### Scenario: Pasta fisica preservada
- **WHEN** o usuario remove uma pasta do GameStock
- **THEN** o sistema MUST NOT apagar a pasta fisica nem os arquivos ROM do disco

### Requirement: Descoberta de ROMs em pastas selecionadas
O sistema SHALL escanear as pastas em `folderPaths` e processar os arquivos individuais em `romFilePaths`, detectar arquivos com extensoes ROM configuradas para a plataforma selecionada e derivar um titulo candidato via normalizacao do nome. O resultado SHALL incluir `candidates`, `ignored` (contagem), `ignoredItems` (lista detalhada com `folderPath`, `romPath`, `filename` e `reason`), `folderPaths`, `romFilePaths` e `includeSubfolders`.

#### Scenario: Descobrir ROMs suportadas por pasta
- **WHEN** `folderPaths` contem pastas com arquivos cujas extensoes principais estao configuradas para a plataforma selecionada
- **THEN** o scan retorna candidatos com `folderPath`, `romPath`, `filename`, `titleCandidate` e dados de plataforma

#### Scenario: Descobrir ROMs em subpastas
- **WHEN** `includeSubfolders = true` e a pasta selecionada contem ROMs suportadas em subdiretorios
- **THEN** o scan retorna esses arquivos como candidatos preservando o `folderPath` real de cada subpasta onde o arquivo foi encontrado

#### Scenario: Ignorar subpastas quando nao solicitado
- **WHEN** `includeSubfolders = false` e a pasta selecionada contem ROMs apenas em subdiretorios
- **THEN** esses arquivos nao entram em `candidates`

#### Scenario: Descobrir ROMs individuais por `romFilePaths`
- **WHEN** `romFilePaths` contem caminhos de arquivos ROM validos
- **THEN** cada arquivo e processado como candidato com `folderPath = dirname(romPath)`

#### Scenario: Ignorar arquivos fora do mapeamento da plataforma
- **WHEN** a pasta contem arquivos com extensoes que nao estao configuradas para a plataforma selecionada (ex: `.txt`, `.jpg` ou ate uma extensao de ROM de outra plataforma)
- **THEN** esses arquivos sao ignorados, contabilizados em `ignored` e listados em `ignoredItems` com o campo `reason` descrevendo que a extensao nao esta configurada para aquela plataforma

### Requirement: Deteccao automatica de plataforma por extensao
O sistema SHALL permitir escanear uma pasta em modo automatico, usando as extensoes principais cadastradas em `platform_rom_extensions` para decidir a plataforma de cada arquivo. O modo automatico SHALL aceitar arquivos de varias plataformas no mesmo scan.

#### Scenario: Detectar multiplas plataformas
- **WHEN** `detectionMode = automatic` e a pasta contem arquivos com extensoes principais exclusivas de plataformas diferentes
- **THEN** cada candidato retorna seu proprio `platformId` e `platformName`, e o resultado inclui `detectedPlatforms` com contagem por plataforma

#### Scenario: Ignorar extensoes genericas
- **WHEN** `detectionMode = automatic` encontra arquivos com extensoes genericas como `.bin`, `.iso`, `.7z`, `.zip`, `.cue`, `.chd` ou equivalentes
- **THEN** esses arquivos nao entram em `candidates` e aparecem em `ignoredItems` com motivo indicando que a extensao e generica

#### Scenario: Ignorar extensoes ambiguas
- **WHEN** uma extensao principal esta cadastrada para mais de uma plataforma no modo automatico
- **THEN** o arquivo e ignorado e `ignoredItems.reason` lista as plataformas que tornam a extensao ambigua

#### Scenario: Importar candidatos automaticos
- **WHEN** o usuario inicia importacao apos scan automatico
- **THEN** cada ROM e criada ou atualizada usando o `platformId` detectado no proprio candidato

### Requirement: Execucao em background e progresso
O sistema SHALL executar o job de importacao de forma assincrona no processo main, emitindo eventos de progresso e conclusao ao renderer via IPC. Ao dispensar uma notificacao de job concluido, falhado ou interrompido, o sistema SHALL remover o job do estado persistido do app (SQLite), garantindo que a notificacao nao reaparea no proximo startup.

#### Scenario: Progresso durante importacao
- **WHEN** um job esta rodando
- **THEN** o renderer recebe eventos `romFolderImport:progress` com `jobId`, `current`, `total`, `folderPath`, `filename`, `imageFilename`, `stage` e `message`

#### Scenario: Conclusao do job
- **WHEN** o job termina
- **THEN** o renderer recebe `romFolderImport:completed` com o resultado incluindo `summary` (`created`, `updated`, `skipped`, `unmatched`, `failedDownloads`, `processed`) e o mesmo `includeSubfolders` usado no scan/import

#### Scenario: Stage de importacao
- **WHEN** o job avanca entre etapas
- **THEN** o `stage` no evento de progresso reflete: `preparing_metadata`, `matching`, `downloading`, `saving` ou `done`

#### Scenario: Dispensar notificacao concluida
- **WHEN** o usuario fecha o card de notificacao de um job com status `completed`, `failed` ou `interrupted`
- **THEN** o job e removido do estado persistido do app e nao reaparece na proxima inicializacao do app

### Requirement: Persistencia de entradas do importador
O sistema SHALL salvar e carregar as entradas de pasta configuradas do estado persistido do app via `appState`, com migracao de formatos legados vindos do `localStorage`.

#### Scenario: Salvar nova entrada
- **WHEN** o usuario inicia uma importacao com sucesso
- **THEN** a entrada `{ folderPath, platformId, platformName, indexedCount, includeSubfolders }` e adicionada ao estado persistido do app

#### Scenario: Salvar entradas automaticas
- **WHEN** o scan automatico detecta varias plataformas na mesma pasta
- **THEN** o estado persistido usa a chave logica `platformId + folderPath`, permitindo varias linhas com a mesma pasta e plataformas diferentes

#### Scenario: Carregar entradas ao abrir
- **WHEN** o RomFolderImporter e montado
- **THEN** as entradas sao carregadas do estado persistido e exibidas na tabela

#### Scenario: Migrar entradas legadas
- **WHEN** o app encontra entradas antigas do importador salvas em `localStorage`
- **THEN** elas sao migradas para `appState`, assumindo `includeSubfolders = false` quando essa informacao nao existir
