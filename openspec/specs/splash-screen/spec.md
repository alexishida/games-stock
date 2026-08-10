# splash-screen Specification

## Purpose
Exibir uma tela de inicializacao dedicada ao fluxo automatico de update antes da janela principal, com status de progresso, fallback offline e erro diagnosticavel.

## Requirements
### Requirement: Splash condicional do updater

A splash SHALL existir apenas no fluxo automatico de update suportado. A janela SHALL ser fixa em `640x400`, sem frame, centralizada, nao redimensionavel, `alwaysOnTop`, `skipTaskbar` e carregada antes da principal.

#### Scenario: Splash e usada

- **WHEN** o app Windows empacotado inicia com updater automatico habilitado
- **THEN** a splash abre antes da janela principal

#### Scenario: Splash nao e usada

- **WHEN** o app inicia em desenvolvimento ou em plataforma sem self-update automatico
- **THEN** a splash nao e criada

### Requirement: Exibicao de build e fases do updater

A splash SHALL mostrar versao e build instaladas, alem da fase atual recebida pelo canal `updater:status`.

#### Scenario: Fase de checking

- **WHEN** o updater inicia a verificacao remota
- **THEN** a splash mostra mensagem equivalente a "Verificando atualizacoes..."

#### Scenario: Fase de downloading

- **WHEN** o updater entra em download
- **THEN** a splash mostra a release alvo e uma barra de progresso percentual

#### Scenario: Fase de applying

- **WHEN** o staging esta sendo preparado
- **THEN** a splash troca a mensagem para a etapa de aplicacao sem reabrir a janela

### Requirement: Overlay de erro e modo offline

A splash SHALL tratar erros de rede e falhas de update com overlays distintos. Quando houver log local disponivel, o caminho SHALL poder ser exibido ao usuario.

#### Scenario: Sem conexao

- **WHEN** o updater emite `phase: "no-connection"` com `requiresAction`
- **THEN** a splash mostra um estado offline com botao para continuar a abertura do app

#### Scenario: Falha ao baixar ou aplicar

- **WHEN** o updater emite `phase: "error"`
- **THEN** a splash mostra falha de update e, se `requiresAction` vier marcado, aguarda a confirmacao do usuario antes de abrir a principal

#### Scenario: Falha herdada do boot anterior

- **WHEN** a aplicacao do staging falhou antes mesmo da splash existir
- **THEN** a splash recebe esse erro pendente no proximo boot e o exibe como falha de update

### Requirement: Splash arrastavel

O corpo da splash SHALL ser arrastavel.

#### Scenario: Usuario arrasta a splash

- **WHEN** o usuario segura e move a area principal da janela
- **THEN** a splash acompanha o cursor como uma janela arrastavel

### Requirement: Timeout maximo de boot

A splash SHALL deixar o app seguir para a janela principal em no maximo 30 segundos.

#### Scenario: Timeout atingido

- **WHEN** o updater excede o limite de 30 segundos
- **THEN** o fluxo automatico e abortado e a janela principal e liberada com a versao atualmente instalada
