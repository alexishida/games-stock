# app-shell - Especificação

## Purpose
Define a base do aplicativo desktop GameStock: janela Electron, isolamento entre processos, inicialização do banco local e menus nativos conectados ao renderer.

## Requirements
### Requirement: Janela principal Electron
O sistema SHALL criar uma janela Electron principal com dimensões mínimas de 1024x768px, título "GameStock", ícone personalizado e frame nativo. A janela SHALL persistir posição e tamanho entre sessões.

#### Scenario: Abertura do app
- **WHEN** o usuário abre o GameStock
- **THEN** a janela principal abre com as últimas dimensões/posição salvas ou 1280x800 na primeira execução

#### Scenario: Fechamento e reabertura
- **WHEN** o usuário fecha e reabre o app
- **THEN** a janela restaura a posição e o tamanho anteriores

### Requirement: Isolamento de processo com contextBridge
O sistema SHALL usar `contextIsolation: true` e `nodeIntegration: false`. O preload SHALL expor `window.gameStockAPI` via `contextBridge.exposeInMainWorld` com os namespaces `games`, `platforms`, `emulators`, `dialogs`, `shell`, `launchbox`, `romFolderImport`, `view` e `library`.

#### Scenario: Acesso seguro ao IPC
- **WHEN** o renderer invoca `window.gameStockAPI.games.list()`
- **THEN** o preload encaminha a chamada via `ipcRenderer.invoke('games:list')` e retorna o resultado do processo main

#### Scenario: Node.js inacessível no renderer
- **WHEN** código no renderer tenta acessar `require` ou `process` diretamente
- **THEN** o acesso é bloqueado pelo isolamento de contexto

### Requirement: Banco de dados SQLite inicializado no startup
O sistema SHALL criar ou abrir o banco SQLite em `%APPDATA%/GameStock/gamestock.db` durante o startup do processo main. O schema SHALL ser aplicado por migrações idempotentes na inicialização.

#### Scenario: Primeiro uso
- **WHEN** o app é aberto pela primeira vez
- **THEN** o arquivo `gamestock.db` é criado com as tabelas principais do app, incluindo `platforms`, `games`, `platform_launchbox_aliases` e `platform_rom_extensions`, e as plataformas padrão são inseridas com seu catálogo inicial

#### Scenario: Uso subsequente
- **WHEN** o app é aberto com banco existente
- **THEN** o banco é aberto sem recriar tabelas e os dados existentes são preservados

### Requirement: Menu nativo da aplicação
O sistema SHALL exibir uma barra de menu nativa. Os itens disponíveis SHALL enviar eventos IPC ao renderer para abrir modais ou atualizar o estado da biblioteca.

#### Scenario: Menu sair
- **WHEN** o usuário clica em Sair no menu nativo
- **THEN** o aplicativo fecha graciosamente

#### Scenario: Menu visualização
- **WHEN** o usuário aciona o item de visualização Grade ou Lista no menu
- **THEN** o renderer recebe o canal `view:set` e alterna entre grade de box arts e visualização em lista

#### Scenario: Menu importar jogos LaunchBox
- **WHEN** o usuário aciona "Importar do LaunchBox" no menu
- **THEN** o renderer recebe o canal `launchbox:openImporter` e abre o modal de importação LaunchBox

#### Scenario: Menu gerenciar plataformas
- **WHEN** o usuário aciona "Gerenciar Plataformas" no menu
- **THEN** o renderer recebe o canal `library:openPlatformManager` e abre o SettingsModal na seção "plataformas"

#### Scenario: Menu criar jogo
- **WHEN** o usuário aciona "Novo Jogo" no menu
- **THEN** o renderer recebe o canal `library:openCreateGame` e abre o ManualGameModal

#### Scenario: Menu ordenar biblioteca
- **WHEN** o usuário aciona uma opção de ordenação no menu
- **THEN** o renderer recebe o canal `library:setSort` com o valor correspondente e aplica a ordenação à biblioteca

#### Scenario: Menu importar pasta de ROMs
- **WHEN** o usuário aciona "Importar pasta de ROMs" no menu
- **THEN** o renderer recebe o canal `romFolderImport:openImporter` e abre o SettingsModal na seção "biblioteca"
