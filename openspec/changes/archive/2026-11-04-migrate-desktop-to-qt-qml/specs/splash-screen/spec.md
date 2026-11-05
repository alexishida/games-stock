<!-- Delta sincronizado com o estado nativo consolidado; não implica arquivamento. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Splash imediata de abertura

O sistema SHALL apresentar StartupSplash.qml antes de abrir o banco e inicializar os serviços de domínio. A janela transitória SHALL ter 480x300 pixels lógicos, sem moldura, centralizada, com logomarca local, versão, mensagem de inicialização e indicador indeterminado, reutilizando SplashOverlay e Theme.qml.

#### Scenario: Abertura normal
- **WHEN** o aplicativo inicia em desenvolvimento, instalação Windows ou modo Portátil
- **THEN** a splash aparece antes do bootstrap do banco, independentemente da rede ou de atualização disponível

#### Scenario: Primeiro quadro da principal
- **WHEN** a janela principal apresenta seu primeiro quadro
- **THEN** a janela transitória é ocultada sem impor um tempo artificial de permanência

#### Scenario: Captura reproduzível
- **WHEN** a execução usa --startup-splash-preview --capture com perfil sintético
- **THEN** a splash permanece para captura e a execução encerra sem consultar o feed

### Requirement: Splash de atualização interna

O sistema SHALL apresentar a atualização automática em SplashOverlay dentro da janela principal. A checagem SHALL começar antes da primeira apresentação da biblioteca em instalação Windows, evitando um flash sem overlay. Capturas SHALL permanecer sem acesso ao feed.

#### Scenario: verificação automática habilitada
- **WHEN** uma instalação Windows NSIS inicia normalmente
- **THEN** o serviço inicia a verificação e o overlay mostra a fase atual

#### Scenario: Canal sem atualização automática
- **WHEN** uma build de desenvolvimento ou Portátil inicia
- **THEN** a splash de bootstrap aparece sem iniciar atualização automática de instalador

### Requirement: Exibicao de build e fases do updater

O overlay SHALL consumir o serviço nativo de atualização e mostrar versão/build instalada, fase, release alvo e progresso disponível com a identidade visual da abertura.

#### Scenario: Fase de checking
- **WHEN** o updater verifica o manifesto remoto
- **THEN** o overlay mostra mensagem de verificação e indicador indeterminado

#### Scenario: Fase de downloading
- **WHEN** o updater baixa o instalador
- **THEN** o overlay mostra versão alvo e barra com o percentual informado pelo serviço

#### Scenario: Fase de applying
- **WHEN** o serviço prepara a execução do instalador
- **THEN** o overlay atualiza a mensagem sem criar outra janela de atualização

### Requirement: Erro e continuação offline

O overlay SHALL mostrar mensagem e detalhe de erro do serviço. Quando requiresAction estiver ativo, SHALL oferecer Continuar offline, acionando skip() para liberar a versão instalada.

#### Scenario: Sem conexão
- **WHEN** a verificação falha por indisponibilidade de rede e requer ação
- **THEN** o usuário vê o motivo e pode continuar offline

#### Scenario: Falha de atualização
- **WHEN** download ou validação falha
- **THEN** o erro é apresentado e nenhum pacote recusado é executado

### Requirement: Interação com o overlay

O overlay SHALL bloquear cliques e rolagem na biblioteca enquanto visível. Seu painel SHALL permitir arraste pelo corpo limitado à área visível, preservando o botão de continuação.

#### Scenario: Arraste do painel
- **WHEN** o usuário arrasta o corpo do painel de atualização
- **THEN** o painel se desloca dentro dos limites da janela principal

### Requirement: Limite de espera por verificação

O serviço SHALL limitar a verificação automática a 30 segundos e apresentar falha com continuação offline quando o limite for atingido.

#### Scenario: Timeout da verificação
- **WHEN** a consulta automática excede o limite
- **THEN** o serviço aborta a operação, informa falta de conexão e permite continuar com a versão instalada
