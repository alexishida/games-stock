## MODIFIED Requirements

### Requirement: Jobs em background com progresso
O sistema SHALL executar exportacao e importacao em worker thread do processo main, emitindo progresso e conclusao por IPC para o renderer. O renderer SHALL persistir o estado do job apenas em transicoes terminais (inicio com `status: "running"`, conclusao, falha e dismiss) — eventos de progresso intermediarios NAO devem gerar escrita no SQLite.

#### Scenario: Exportacao em background
- **WHEN** o usuario inicia uma exportacao valida
- **THEN** o sistema retorna um job de exportacao imediatamente, executa o pacote em worker thread e emite eventos `dataPortability:progress` ate a conclusao

#### Scenario: Importacao em background
- **WHEN** o usuario confirma uma importacao valida
- **THEN** o sistema retorna um job de importacao imediatamente, executa a restauracao em worker thread e emite eventos `dataPortability:progress` e `dataPortability:completed`

#### Scenario: Notificacao de portabilidade
- **WHEN** um job de exportacao ou importacao esta rodando
- **THEN** o NotificationCenter exibe card com barra de progresso, etapa atual e status final do job

#### Scenario: Deteccao de job interrompido
- **WHEN** o app e iniciado e existe um job com `status: "running"` no estado persistido
- **THEN** o sistema converte o status para `"interrupted"` sem necessidade de ticks intermediarios terem sido persistidos
