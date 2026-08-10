# app-shell Specification

## Purpose
Definir a base do aplicativo desktop GameStock: bootstrap do Electron, janela principal, fronteira IPC segura, inicializacao do banco local e protocolo interno de midia.

## Requirements
### Requirement: Janela principal Electron

O sistema SHALL criar uma janela principal Electron com `minWidth = 1024`, `minHeight = 768`, titulo `GameStock v<build>`, icone do app e persistencia de posicao/tamanho em `window-bounds.json`. Na primeira execucao, a janela SHALL usar `1225x818` como dimensao padrao.

#### Scenario: Boot direto sem splash

- **WHEN** o app inicia em desenvolvimento ou em plataforma sem self-update in-place
- **THEN** a janela principal abre diretamente sem passar pela splash

#### Scenario: Boot com splash antes da principal

- **WHEN** o app empacotado para Windows inicia com updater habilitado
- **THEN** a janela principal so e criada depois que o fluxo de splash/update libera a abertura

#### Scenario: Restaurar bounds anteriores

- **WHEN** o usuario fecha e reabre o app
- **THEN** a janela reutiliza os bounds persistidos da sessao anterior

### Requirement: Isolamento de processo com contextBridge

O sistema SHALL usar `contextIsolation: true` e `nodeIntegration: false`. O preload SHALL expor `window.gameStockAPI` com os namespaces `games`, `platforms`, `emulators`, `dialogs`, `shell`, `app`, `updater`, `appState`, `dataPortability`, `launchbox`, `romFolderImport`, `library`, `view` e `hardwareInventory`.

#### Scenario: Acesso seguro ao IPC

- **WHEN** o renderer invoca `window.gameStockAPI.games.list()`
- **THEN** o preload encaminha a chamada ao canal IPC correspondente e retorna apenas o resultado serializado

#### Scenario: Node.js inacessivel no renderer

- **WHEN** codigo do renderer tenta usar `require` ou outras APIs Node diretamente
- **THEN** o isolamento de contexto impede esse acesso fora da API exposta

#### Scenario: Namespace de updater disponivel

- **WHEN** a splash ou a tela Sobre invocam `window.gameStockAPI.updater`
- **THEN** o preload oferece os metodos de status, check manual, skip e informacoes da build sem expor objetos Electron crus

### Requirement: Banco SQLite inicializado no startup

O sistema SHALL criar ou abrir `gamestock.db` dentro do diretorio de dados do usuario configurado para o app. O startup SHALL preparar tambem os diretorios `images/`, `inventario/images/`, `session/` e `Cache/`, alem de aplicar schema, migrations e seeds idempotentes.

#### Scenario: Primeiro uso

- **WHEN** o app abre pela primeira vez
- **THEN** o arquivo `gamestock.db` e criado junto com as tabelas principais, plataformas default, RetroArch default e defaults do inventario

#### Scenario: Uso subsequente

- **WHEN** o app abre com banco existente
- **THEN** os dados sao preservados e apenas migrations/seeds idempotentes necessarias sao reaplicadas

### Requirement: Shell sem menu nativo

O sistema SHALL remover o menu nativo padrao do Electron em runtime.

#### Scenario: Aplicacao inicia

- **WHEN** o bootstrap conclui `app.whenReady()`
- **THEN** `Menu.setApplicationMenu(null)` e aplicado e a navegacao principal passa a depender apenas da UI do renderer e dos canais IPC dedicados

### Requirement: Protocolo seguro de midia local

O sistema SHALL registrar o protocolo customizado `gamestock-media://` como `secure` e restrito ao diretorio `userData` do app.

#### Scenario: Arquivo permitido

- **WHEN** o renderer solicita `gamestock-media://?path=<arquivo dentro de userData>`
- **THEN** o processo main serve o arquivo local

#### Scenario: Tentativa de escapar do userData

- **WHEN** a URL aponta para um caminho fora do diretorio de dados do app
- **THEN** o processo main responde `403 Forbidden`
