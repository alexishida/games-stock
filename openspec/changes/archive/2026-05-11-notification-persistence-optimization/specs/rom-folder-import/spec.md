## MODIFIED Requirements

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
