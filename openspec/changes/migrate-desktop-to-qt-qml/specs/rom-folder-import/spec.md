<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Resumo de pastas configuradas (SummaryStep)
O sistema SHALL exibir na tela inicial do RomFolderImporter uma tabela com todas as pastas ja configuradas, mostrando caminho, plataforma associada, quantidade de jogos indexados e se aquela entrada inclui busca em subpastas. As entradas SHALL ser persistidas no estado de app via `serviço persistente de estado do app` e armazenadas no SQLite local.

#### Scenario: Abrir com pastas configuradas
- **WHEN** o usuario abre o RomFolderImporter com entradas salvas
- **THEN** a tabela exibe cada entrada com `folderPath`, `platformName`, `indexedCount` e indicador de `includeSubfolders` quando ativo

#### Scenario: Abrir sem pastas configuradas
- **WHEN** nao ha entradas salvas no estado persistido do app
- **THEN** a tabela exibe estado vazio e o botao "Adicionar Pasta" esta visivel

#### Scenario: Continuar downloads de pasta existente
- **WHEN** o usuario seleciona uma linha e clica em "Continuar downloads"
- **THEN** o sistema inicia um job de importacao em background para aquela pasta usando a plataforma ja salva e fecha o overlay

### Requirement: Execucao em background e progresso
O sistema SHALL executar o job de importacao de forma assincrona fora da thread da interface, emitindo eventos de progresso e conclusao à interface por atualizações observáveis. Ao dispensar uma notificacao de job concluido, falhado ou interrompido, o sistema SHALL remover o job do estado persistido do app (SQLite), garantindo que a notificacao nao reaparea no proximo startup.

#### Scenario: Progresso durante importacao
- **WHEN** um job esta rodando
- **THEN** a interface recebe eventos `romFolderImport:progress` com `jobId`, `current`, `total`, `folderPath`, `filename`, `imageFilename`, `stage` e `message`

#### Scenario: Conclusao do job
- **WHEN** o job termina
- **THEN** a interface recebe `romFolderImport:completed` com o resultado incluindo `summary` (`created`, `updated`, `skipped`, `unmatched`, `failedDownloads`, `processed`) e o mesmo `includeSubfolders` usado no scan/import

#### Scenario: Stage de importacao
- **WHEN** o job avanca entre etapas
- **THEN** o `stage` no evento de progresso reflete: `preparing_metadata`, `matching`, `downloading`, `saving` ou `done`

#### Scenario: Dispensar notificacao concluida
- **WHEN** o usuario fecha o card de notificacao de um job com status `completed`, `failed` ou `interrupted`
- **THEN** o job e removido do estado persistido do app e nao reaparece na proxima inicializacao do app


