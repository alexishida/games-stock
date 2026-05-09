## MODIFIED Requirements

### Requirement: Isolamento de processo com contextBridge
O sistema SHALL usar `contextIsolation: true` e `nodeIntegration: false`. O preload SHALL expor `window.gameStockAPI` via `contextBridge.exposeInMainWorld` com os namespaces `games`, `platforms`, `emulators`, `dialogs`, `shell`, `app`, `dataPortability`, `launchbox`, `romFolderImport`, `view` e `library`.

#### Scenario: Acesso seguro ao IPC
- **WHEN** o renderer invoca `window.gameStockAPI.games.list()`
- **THEN** o preload encaminha a chamada via `ipcRenderer.invoke('games:list')` e retorna o resultado do processo main

#### Scenario: Node.js inacessivel no renderer
- **WHEN** codigo no renderer tenta acessar `require` ou `process` diretamente
- **THEN** o acesso e bloqueado pelo isolamento de contexto

#### Scenario: Acesso seguro a portabilidade
- **WHEN** o renderer invoca `window.gameStockAPI.dataPortability.exportPackage`, `previewImport` ou `importPackage`
- **THEN** o preload encaminha a chamada para canais IPC dedicados sem expor APIs Node.js diretamente ao renderer
