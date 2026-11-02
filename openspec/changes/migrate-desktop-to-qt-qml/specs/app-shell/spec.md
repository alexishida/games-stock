<!-- Substitui contratos de Electron por um shell desktop com fronteiras equivalentes. -->
# Spec Delta

## RENAMED Requirements
- FROM: `### Requirement: Janela principal Electron`
- TO: `### Requirement: Janela principal desktop`
- FROM: `### Requirement: Isolamento de processo com contextBridge`
- TO: `### Requirement: Fronteira controlada de servicos desktop`

## MODIFIED Requirements

### Requirement: Janela principal desktop

O sistema SHALL abrir uma janela principal com tamanho inicial 1122x957, mínimo 1024x768, título `GameStock v<build>`, ícone e persistência em `window-bounds.json`. A geometria restaurada SHALL permanecer acessível nos monitores conectados.

#### Scenario: Boot direto sem splash
- **WHEN** o app inicia em desenvolvimento ou em plataforma sem self-update in-place
- **THEN** a janela principal abre diretamente sem passar pela splash

#### Scenario: Boot com splash antes da principal
- **WHEN** o app instalado Windows inicia com updater habilitado
- **THEN** a janela principal é apresentada depois que o fluxo de splash/update libera a abertura

#### Scenario: Restaurar bounds anteriores
- **WHEN** o usuário fecha e reabre o app com geometria persistida pela implementação anterior
- **THEN** a janela reutiliza posição e tamanho, ajustando os limites se um monitor foi desconectado

### Requirement: Fronteira controlada de servicos desktop

A interface SHALL acessar jogos, plataformas, emuladores, diálogos, shell, app, updater, estado, portabilidade, metadados, importação de ROMs, navegação e inventário por serviços controlados. O runtime distribuído SHALL funcionar sem Electron, Node.js, React ou WebView.

#### Scenario: Acesso seguro ao IPC
- **WHEN** a interface solicita jogos com filtros
- **THEN** o serviço valida parâmetros e retorna resultados sem expor objetos de banco ou execução arbitrária de comandos

#### Scenario: Node.js inacessivel no renderer
- **WHEN** uma entrada externa tenta carregar código ou acionar um comando fora dos serviços permitidos
- **THEN** o sistema rejeita a operação e não executa código arbitrário

#### Scenario: Namespace de updater disponivel
- **WHEN** a splash ou a tela Sobre consulta o updater
- **THEN** estão disponíveis status, busca manual, continuação sem atualizar e informações da build

### Requirement: Shell sem menu nativo

O sistema SHALL manter a navegação pela interface principal, sem adicionar menu nativo padrão ao aplicativo.

#### Scenario: Aplicacao inicia
- **WHEN** o bootstrap conclui
- **THEN** biblioteca, inventário e configurações são acessíveis pela interface principal

### Requirement: Protocolo seguro de midia local

O sistema SHALL carregar mídias locais por uma fronteira restrita ao diretório de dados do app, sem depender de protocolo de navegador. Caminhos SHALL ser validados após resolução canônica, incluindo symlinks.

#### Scenario: Arquivo permitido
- **WHEN** a interface solicita uma imagem dentro do perfil ativo
- **THEN** o sistema apresenta a mídia existente sem mover ou reimportar o arquivo

#### Scenario: Tentativa de escapar do userData
- **WHEN** o caminho solicitado resolve para fora do perfil ativo
- **THEN** o carregamento é recusado sem expor o arquivo


