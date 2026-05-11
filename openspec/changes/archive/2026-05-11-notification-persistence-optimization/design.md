## Context

O store Zustand (`src/renderer/store/index.ts`) persiste jobs assíncronos no SQLite via `appStatePersistence.ts` para sobreviver a restarts do app. O problema: as actions de *progresso* (`updateRomImportProgress`, `updateMediaSyncProgress`, `updateDataPortabilityProgress`) chamam `setPersistedXxx()` a cada tick — potencialmente centenas de writes IPC por segundo durante um import ativo.

A detecção de "interrupted" (job que estava rodando quando o app fechou) funciona assim: qualquer job com `status: "running"` lido do SQLite na inicialização é convertido para `"interrupted"` pelos próprios `getPersistedXxx()`. Isso significa que **basta persistir o job no início** (quando `status: "running"`) para que a detecção de interrupted funcione corretamente.

Há também uma inconsistência no dismiss: jobs de media sync e data portability chamam `dismissXxx()` que remove do store e do SQLite, mas o dismiss de ROM import apenas adiciona ao `dismissedIds` local do componente — o job permanece no SQLite e reaparece no próximo startup.

## Goals / Non-Goals

**Goals:**
- Eliminar writes SQLite no hot-path de progresso (IPC fire-and-forget a cada tick)
- Garantir que dismiss de ROM import limpe o job do SQLite, igual aos demais tipos
- Manter a detecção de "interrupted" intacta após crash/fechamento

**Non-Goals:**
- Redesenhar a arquitetura de persistência de jobs (mover para main process)
- Alterar schema SQLite, IPC channels ou preload API
- Tratar a migration de localStorage legado

## Decisions

**D1: Remover persist das actions de progresso, não das terminais**

Alternativa considerada: throttle/debounce dos writes (ex: a cada 5 segundos). Descartada porque não resolve o caso de múltiplos jobs concorrentes e adiciona complexidade. A solução correta é só persistir em transições de estado, não em ticks de dados.

Resultado: `updateRomImportProgress`, `updateMediaSyncProgress`, `updateDataPortabilityProgress` e `hydrateRomImportJobs` não chamam mais `setPersistedXxx()`. Todas as demais actions que mudam status (start, complete, fail, dismiss) mantêm a persistência.

**D2: Fix de dismiss via `setLastRomImportJob(null)` em `RomNotificationCard`**

`setLastRomImportJob(null)` já chama `setPersistedLastRomImportJob(null)` que remove do SQLite — reutiliza path existente sem nova lógica. O `onDismiss()` do componente pai continua sendo chamado para atualizar o `dismissedIds` local (por consistência, embora o card já não apareça após o job sair do store).

## Risks / Trade-offs

- **Interrupted detection após crash no meio de um progresso** → Sem risco: o job já foi persistido com `status: "running"` quando iniciou. O crash não altera o SQLite. Na próxima leitura, o status "running" é convertido para "interrupted".
- **Job completa mas app fecha antes de persistir o terminal state** → Risco muito baixo: a janela entre `completeRomImportJob` e o write assíncrono é de milissegundos. Aceitável.
- **`hydrateRomImportJobs` sobrescrever job SQLite com job vazio do main process** → Eliminado: sem o write, o job SQLite permanece intacto se o Map do main process estiver vazio (startup normal).
