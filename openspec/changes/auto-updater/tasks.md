## 1. Configuração e estrutura base

- [x] 1.1 Criar `src/shared/update-config.ts` com a constante `UPDATE_MANIFEST_URL` lida via `import.meta.env` / `define` do Vite
- [x] 1.2 Adicionar os canais IPC de update em `src/shared/ipc-channels.ts` (`updater:status`, `updater:skip`, `updater:open-main`, `updater:get-app-info`)
- [x] 1.3 Criar tipos compartilhados para o payload de status do updater (`UpdaterStatus`, `UpdaterPhase`) em `src/shared/` — incluir phase `'no-connection'` distinto de `'error'`

## 2. Módulo de update no processo main

- [x] 2.1 Criar `src/main/updater.ts` com a função `checkForUpdate()` que faz fetch do JSON remoto com timeout de 5s, diferenciando erro de rede (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) de erro de servidor (HTTP não-200)
- [x] 2.2 Implementar comparação de versão semântica (remota vs. `app.getVersion()`) em `updater.ts`
- [x] 2.3 Implementar `downloadUpdate(url, onProgress)` que salva o `.zip` em diretório temporário e emite progresso via callback
- [x] 2.4 Implementar `applyUpdate(zipPath)` que extrai o zip para `_update_staging` ao lado de `resourcesPath`
- [x] 2.5 Implementar detecção da flag `--apply-update <stagingPath>` no startup do main e lógica de cópia dos arquivos de staging para `resourcesPath/app`
- [x] 2.6 Implementar limpeza do diretório de staging após aplicação bem-sucedida ou em caso de falha

## 3. Splash screen — janela Electron

- [x] 3.1 Criar `src/splash/` com `index.html` e entry point React mínimo para o renderer da splash
- [x] 3.2 Configurar o Vite para compilar o entry point da splash como página separada
- [x] 3.3 Criar `SplashWindow` em `src/main/splash-window.ts` que abre a `BrowserWindow` da splash (sem frame, always-on-top, centralizada, sem taskbar)

## 4. Splash screen — renderer React

- [x] 4.1 Criar componente `SplashScreen` com logo, versão local (`v1.2.0`) e número de build (`build 42`) lidos via IPC de `app.getVersion()` e variável de build, mensagem de status e barra de progresso (usando classes CSS do design system do projeto)
- [x] 4.2 Implementar listener do canal `updater:status` no renderer da splash para atualizar estado em tempo real, incluindo tratamento da phase `'no-connection'` que exibe o modal de erro
- [x] 4.5 Criar modal de erro de conexão sobreposto à splash com mensagem explicativa e botão "Continuar em modo offline" que dispara `updater:skip` e fecha o modal + a splash
- [x] 4.3 Implementar drag da splash via `-webkit-app-region: drag` no CSS do container (excluindo botões se houver)
- [x] 4.4 Criar CSS da splash seguindo as variáveis e padrões de `.ai-framework/DESIGN.md`

## 5. Handlers IPC e orquestração no main

- [x] 5.1 Registrar handler `updater:skip` em `src/main/index.ts` para caso o usuário cancele na splash
- [x] 5.2 Criar função `runUpdateFlow(splashWindow)` em `updater.ts` que orquestra check → download → apply → relaunch, emitindo eventos de status para a splash via `splashWindow.webContents.send`
- [x] 5.3 Implementar timeout máximo de 30s na `runUpdateFlow`: ao atingir, fechar splash e abrir janela principal
- [x] 5.4 Registrar handler `updater:get-app-info` no main retornando `{ version: app.getVersion(), buildNumber: BUILD_NUMBER }` (constante injetada pelo Vite)
- [x] 5.5 Expor `updater` namespace em `src/preload/index.ts` via `contextBridge` com `onStatus(callback)`, `skip()` e `getAppInfo()`
- [x] 5.6 Atualizar `src/preload/types.d.ts` com os tipos do namespace `updater`

## 6. Integração com inicialização do app

- [x] 6.1 Modificar `src/main/index.ts` para abrir a `SplashWindow` antes da janela principal
- [x] 6.2 Verificar flag `--apply-update` no startup e executar cópia de staging antes de qualquer outra inicialização
- [x] 6.3 Pular splash e verificação de update quando `UPDATE_MANIFEST_URL` não estiver definida (ambiente de dev)
- [x] 6.4 Garantir que a janela principal só seja criada após `runUpdateFlow` resolver (com ou sem update)

## 7. Build e publicação

- [x] 7.1 Adicionar `UPDATE_MANIFEST_URL` no `define` do `vite.config.ts` (lida de variável de ambiente no CI)
- [x] 7.2 Documentar o formato do JSON de metadados e o processo de publicação de release no `README.md` ou doc interna
