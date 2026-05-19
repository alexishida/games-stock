# splash-screen Specification

## Purpose
TBD - created by archiving change auto-updater. Update Purpose after archive.
## Requirements
### Requirement: Splash screen exibida na inicialização

O sistema SHALL exibir uma splash screen centralizada, sem frame nativo, sempre no topo, antes de abrir a janela principal. A splash SHALL mostrar o nome/logo do app, a versão do app e o número do build instalados localmente, e uma mensagem de status que reflete a fase atual do fluxo de atualização.

#### Scenario: Splash abre ao iniciar o app

- **WHEN** o usuário abre o GameStock
- **THEN** uma janela pequena sem bordas nativas abre no centro da tela com o logo, a versão local no formato `v1.2.0` e o build no formato `build 42`, e a mensagem "Verificando atualizações..."

#### Scenario: Status atualizado em tempo real

- **WHEN** o processo main envia um evento de progresso (fase: checking / downloading / applying / up-to-date / error)
- **THEN** a mensagem na splash é atualizada para refletir a fase atual sem fechar ou reabrir a janela

#### Scenario: Progresso de download visível

- **WHEN** o update está sendo baixado
- **THEN** a splash exibe uma barra de progresso com percentual do download concluído

#### Scenario: Splash fecha e janela principal abre

- **WHEN** o fluxo de verificação conclui sem update (versão atual) ou após aplicar o update e relançar
- **THEN** a splash fecha e a janela principal do GameStock abre normalmente

#### Scenario: Sem conexão com a internet — modal de erro exibido

- **WHEN** a verificação de update falha por ausência de conexão com a internet (erro de rede / timeout)
- **THEN** a splash exibe um modal de erro sobre ela mesma informando que não foi possível verificar atualizações por falta de conexão, com um botão "Continuar em modo offline"

#### Scenario: Usuário continua em modo offline

- **WHEN** o usuário clica em "Continuar em modo offline" no modal de erro de conexão
- **THEN** o modal fecha, a splash fecha, e a janela principal abre normalmente sem ter verificado ou aplicado updates

#### Scenario: Erro de servidor não bloqueia o app

- **WHEN** a verificação de update falha por erro de servidor (resposta não-200, JSON inválido) — não por falta de conexão
- **THEN** a splash exibe brevemente a mensagem de erro e fecha em seguida, abrindo a janela principal normalmente sem exibir modal

#### Scenario: Splash arrastável

- **WHEN** o usuário clica e arrasta o corpo da splash screen
- **THEN** a janela se move junto com o cursor dentro dos limites da tela

### Requirement: Timeout máximo da splash

O sistema SHALL garantir que a splash feche e a janela principal abra em no máximo 30 segundos, independente do estado do fluxo de atualização.

#### Scenario: Timeout atingido

- **WHEN** 30 segundos se passam sem o fluxo de update concluir
- **THEN** a splash fecha, o processo de download/aplicação em andamento é abortado, e a janela principal abre com a versão atual instalada

