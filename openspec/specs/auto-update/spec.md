# auto-update Specification

## Purpose
Orquestrar verificacao remota de release e self-update in-place apenas para builds Windows empacotadas, mantendo consulta manual e atualizacao externa nas demais plataformas.

## Requirements
### Requirement: Verificacao remota por manifesto JSON

O sistema SHALL consultar um manifesto remoto configurado em build por `UPDATE_MANIFEST_URL`, com timeout de 5 segundos. O parser SHALL aceitar tanto os campos atuais `version`, `buildNumber`, `releaseDate`, `downloadUrl` e `releaseNotes` quanto os aliases legados `versao`, `build`, `data` e `path`.

#### Scenario: Release remota mais nova

- **WHEN** o manifesto remoto traz versao semver maior que a local, ou mesma versao com build diferente
- **THEN** o updater considera que existe release aplicavel

#### Scenario: Manifesto invalido

- **WHEN** o JSON remoto nao contem os campos obrigatorios aceitos
- **THEN** o updater trata a verificacao como erro e nao inicia download

#### Scenario: Sem conexao

- **WHEN** a consulta falha com erro de rede ou timeout
- **THEN** o updater emite `phase: "no-connection"` com erro detalhado e registra log local

### Requirement: Fluxo automatico restrito a Windows empacotado

O sistema SHALL executar o fluxo automatico de check, download e staging apenas quando `app.isPackaged` for verdadeiro e a plataforma atual suportar self-update in-place.

#### Scenario: Windows empacotado suportado

- **WHEN** o app inicia em build Windows empacotada
- **THEN** o bootstrap pode abrir a splash e executar o fluxo automatico do updater

#### Scenario: Linux ou ambiente sem suporte

- **WHEN** o app inicia fora desse contexto suportado
- **THEN** o bootstrap pula o fluxo automatico e abre a janela principal normalmente

### Requirement: Download validado do pacote

O sistema SHALL baixar o ZIP remoto para um diretorio temporario local, anexando um `timestamp` na URL para evitar cache intermediario. O progresso SHALL ser emitido via `updater:status` e o arquivo baixado SHALL ser validado contra `Content-Length` quando esse cabecalho existir.

#### Scenario: Download concluido

- **WHEN** o arquivo remoto e baixado integralmente
- **THEN** o updater avanca para a etapa de staging e emite progresso ate 100%

#### Scenario: Download incompleto

- **WHEN** o tamanho final diverge de `Content-Length` ou o fluxo falha no meio
- **THEN** o ZIP temporario e removido e o updater retorna erro sem sobrescrever a instalacao atual

### Requirement: Staging, relaunch e aplicacao antecipada

O sistema SHALL extrair o ZIP para um diretorio de staging unico `_update_staging_<suffix>` ao lado de `process.resourcesPath`, relancar o app com `--apply-update <stagingRoot>` e aplicar os arquivos antes de carregar o bundle principal na proxima inicializacao.

#### Scenario: Staging preparado

- **WHEN** a extracao do ZIP conclui com payload valido
- **THEN** o app chama `app.relaunch()` com `--apply-update` e encerra a sessao atual

#### Scenario: Aplicacao no boot seguinte

- **WHEN** o processo inicia com `--apply-update <stagingRoot>`
- **THEN** o bootstrap copia `app/` ou `resources/app.asar` do staging para a instalacao real antes de carregar `index.ts`

#### Scenario: Falha ao aplicar staging

- **WHEN** a copia do staging falha
- **THEN** o updater registra erro, limpa o staging e preserva a versao anterior instalada

### Requirement: Timeout global do fluxo automatico

O sistema SHALL limitar o fluxo da splash/update a 30 segundos no boot automatico.

#### Scenario: Timeout atingido

- **WHEN** o fluxo nao conclui dentro de 30 segundos
- **THEN** o updater aborta o trabalho em andamento, libera a abertura do app e nao bloqueia o boot

### Requirement: Verificacao manual na janela principal

O sistema SHALL permitir que a tela Sobre dispare uma verificacao manual reutilizando o mesmo backend do updater.

#### Scenario: Release nova em Linux

- **WHEN** o usuario executa "Buscar atualizacao" em Linux ou outra plataforma sem self-update in-place
- **THEN** o app consulta o manifesto e responde com `phase: "external-update"` sem baixar ZIP nem relancar

#### Scenario: Release nova em Windows

- **WHEN** o usuario executa a verificacao manual em Windows suportado
- **THEN** o app baixa o pacote, prepara staging e reinicia automaticamente ao concluir
