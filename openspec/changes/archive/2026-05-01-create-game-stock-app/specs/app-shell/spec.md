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
O sistema SHALL usar `contextIsolation: true` e `nodeIntegration: false`. O preload SHALL expor `window.gameStockAPI` via `contextBridge.exposeInMainWorld` com os namespaces `games`, `platforms`, `dialogs` e `shell`.

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
- **THEN** o arquivo `gamestock.db` é criado com as tabelas `platforms` e `games`

#### Scenario: Uso subsequente
- **WHEN** o app é aberto com banco existente
- **THEN** o banco é aberto sem recriar tabelas e os dados existentes são preservados

### Requirement: Menu nativo da aplicação
O sistema SHALL exibir uma barra de menu nativa com itens MENU, FERRAMENTAS, VISUALIZAÇÃO, ORGANIZADO POR, GRUPO DE IMAGENS e EMBLEMAS. Itens disponíveis no MVP SHALL enviar eventos ao renderer para abrir diálogos ou atualizar o estado da biblioteca.

#### Scenario: Menu sair
- **WHEN** o usuário clica em MENU -> Sair
- **THEN** o aplicativo fecha graciosamente

#### Scenario: Menu visualização
- **WHEN** o usuário clica em VISUALIZAÇÃO -> Grade ou Lista
- **THEN** a área principal alterna entre grade de box arts e visualização em lista

#### Scenario: Menu importar jogos
- **WHEN** o usuário clica em MENU -> Importar Jogos ou FERRAMENTAS -> Importar do LaunchBox
- **THEN** o modal de importação LaunchBox é aberto

#### Scenario: Menu gerenciar plataformas
- **WHEN** o usuário clica em MENU -> Gerenciar Plataformas
- **THEN** a interface de gerenciamento de plataformas é aberta

#### Scenario: Menu organizar por
- **WHEN** o usuário clica em ORGANIZADO POR -> Título, Ano ou Recentes
- **THEN** a biblioteca aplica a ordenação selecionada
