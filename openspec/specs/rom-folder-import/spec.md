# rom-folder-import - Especificação

## Purpose
Define o assistente de importação em lote por pastas de ROMs, com resumo de pastas configuradas, adição/remoção de entradas, descoberta de ROMs, execução em background e notificações de progresso.

## Requirements
### Requirement: Resumo de pastas configuradas (SummaryStep)
O sistema SHALL exibir na tela inicial do RomFolderImporter uma tabela com todas as pastas já configuradas, mostrando caminho, plataforma associada e quantidade de jogos indexados. As entradas SHALL ser persistidas em `localStorage`.

#### Scenario: Abrir com pastas configuradas
- **WHEN** o usuário abre o RomFolderImporter com entradas salvas
- **THEN** a tabela exibe cada entrada com folderPath, platformName e indexedCount

#### Scenario: Abrir sem pastas configuradas
- **WHEN** não há entradas salvas no localStorage
- **THEN** a tabela exibe estado vazio e o botão "Adicionar Pasta" está visível

#### Scenario: Continuar downloads de pasta existente
- **WHEN** o usuário seleciona uma linha e clica em "Continuar downloads"
- **THEN** o sistema inicia um job de importação em background para aquela pasta usando a plataforma já salva e fecha o overlay

### Requirement: Adicionar nova pasta de ROMs
O sistema SHALL fornecer um fluxo de dois passos (configure → review) dentro de um overlay modal para adicionar uma nova pasta ao índice. O scan aceita uma lista de `folderPaths` (pastas inteiras) e/ou `romFilePaths` (arquivos ROM individuais).

#### Scenario: Abrir formulário de configuração
- **WHEN** o usuário clica em "Adicionar Pasta"
- **THEN** o overlay do AddFolderPanel é exibido no passo "configure" com campo de pasta e select de plataforma

#### Scenario: Selecionar pasta pelo browser nativo
- **WHEN** o usuário clica para selecionar pasta
- **THEN** o diálogo nativo de seleção de pasta é aberto e o caminho escolhido é preenchido no campo

#### Scenario: Avançar para revisão
- **WHEN** o usuário clica em "Próximo" com pasta e plataforma selecionadas
- **THEN** o sistema chama `romFolderImport:scan` e avança para o passo "review" com lista de candidatos encontrados

#### Scenario: Revisão antes de importar
- **WHEN** o passo "review" é exibido
- **THEN** o assistente mostra quantidade de ROMs encontradas, arquivos ignorados e lista de candidatos (filename e titleCandidate)

#### Scenario: Voltar para configuração
- **WHEN** o usuário clica em "Voltar" no passo "review"
- **THEN** o assistente retorna ao passo "configure" sem perder pasta e plataforma selecionadas

#### Scenario: Pasta vazia
- **WHEN** o scan retorna zero candidatos
- **THEN** o passo "review" exibe estado vazio e não permite iniciar a importação

#### Scenario: Iniciar importação em background
- **WHEN** o usuário clica em "Iniciar em background" no passo "review"
- **THEN** o sistema chama `romFolderImport:import`, fecha o overlay, salva a entrada no localStorage e inicia o job

### Requirement: Remoção de pasta configurada
O sistema SHALL permitir remover uma entrada da tabela, excluindo também os jogos indexados com `rom_path` dentro daquela pasta.

#### Scenario: Confirmar remoção de pasta
- **WHEN** o usuário seleciona uma linha, clica em "Deletar Pasta" e confirma
- **THEN** a entrada é removida do localStorage e `romFolderImport:deleteFolderRecords` é chamado para remover os jogos associados

#### Scenario: Pasta física preservada
- **WHEN** o usuário remove uma pasta do GameStock
- **THEN** o sistema MUST NOT apagar a pasta física nem os arquivos ROM do disco

### Requirement: Descoberta de ROMs em pastas selecionadas
O sistema SHALL escanear as pastas em `folderPaths` e processar os arquivos individuais em `romFilePaths`, detectar arquivos com extensões ROM suportadas e derivar um título candidato via normalização do nome. O resultado SHALL incluir `candidates`, `ignored` (contagem), `ignoredItems` (lista detalhada com `folderPath`, `romPath`, `filename` e `reason`), `folderPaths` e `romFilePaths`.

#### Scenario: Descobrir ROMs suportadas por pasta
- **WHEN** `folderPaths` contém pastas com arquivos de extensões suportadas (.zip, .rom, .bin, .iso, .img, .cue, .nes, .snes, .sfc, .smc, .swc, .fig, .smd, .md, .n64, .z64, .v64, .gb, .gbc, .gba)
- **THEN** o scan retorna candidatos com `folderPath`, `romPath`, `filename`, `titleCandidate` e dados de plataforma

#### Scenario: Descobrir ROMs individuais por `romFilePaths`
- **WHEN** `romFilePaths` contém caminhos de arquivos ROM válidos
- **THEN** cada arquivo é processado como candidato com `folderPath = dirname(romPath)`

#### Scenario: Ignorar arquivos não suportados
- **WHEN** a pasta contém arquivos com extensões não suportadas (ex: .txt, .jpg, .xml)
- **THEN** esses arquivos são ignorados, contabilizados em `ignored` e listados em `ignoredItems` com o campo `reason` descrevendo a extensão não suportada

### Requirement: Execução em background e progresso
O sistema SHALL executar o job de importação de forma assíncrona no processo main, emitindo eventos de progresso e conclusão ao renderer via IPC.

#### Scenario: Progresso durante importação
- **WHEN** um job está rodando
- **THEN** o renderer recebe eventos `romFolderImport:progress` com jobId, current, total, folderPath, filename, imageFilename, stage e message

#### Scenario: Conclusão do job
- **WHEN** o job termina
- **THEN** o renderer recebe `romFolderImport:completed` com o resultado incluindo summary (created, updated, skipped, unmatched, failedDownloads, processed)

#### Scenario: Stage de importação
- **WHEN** o job avança entre etapas
- **THEN** o stage no evento de progresso reflete: "preparing_metadata", "matching", "downloading", "saving" ou "done"

### Requirement: Persistência de entradas no localStorage
O sistema SHALL salvar e carregar as entradas de pasta configuradas do `localStorage` do renderer, com migração de formatos legados.

#### Scenario: Salvar nova entrada
- **WHEN** o usuário inicia uma importação com sucesso
- **THEN** a entrada `{ folderPath, platformId, platformName, indexedCount }` é adicionada ao localStorage

#### Scenario: Carregar entradas ao abrir
- **WHEN** o RomFolderImporter é montado
- **THEN** as entradas são carregadas do localStorage e exibidas na tabela
