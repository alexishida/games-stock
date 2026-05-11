## Why

O sistema de notificações persiste o estado de jobs (ROM import, media sync, data portability) no SQLite a cada tick de progresso via IPC (renderer → main → SQLite), gerando centenas de writes desnecessários por segundo durante imports ativos. Além disso, o dismiss de notificações de ROM import não limpava o job do SQLite, causando reaparecimento da notificação no próximo startup.

## What Changes

- Remover chamadas `setPersistedXxx()` das actions de progresso `updateRomImportProgress`, `updateMediaSyncProgress` e `updateDataPortabilityProgress` no Zustand store
- Remover write redundante de `hydrateRomImportJobs` (chamada no startup com jobs do in-memory Map do main process)
- Corrigir dismiss de ROM import notifications para chamar `setLastRomImportJob(null)`, alinhando com o comportamento de media e data portability jobs
- Persistência limitada a: job start, transições terminais (completed/failed) e dismiss

## Capabilities

### New Capabilities
- Nenhuma nova capability

### Modified Capabilities
- `rom-folder-import`: Comportamento de dismiss de notificação agora remove o job do SQLite (antes ficava orphaned)
- `data-portability`: Regra de persistência de jobs agora documentada — sem writes em progress ticks

## Impact

- `src/renderer/store/index.ts` — removidas 4 chamadas `setPersistedXxx()` das actions de progresso e hydration
- `src/renderer/components/NotificationCenter/NotificationCenter.tsx` — `RomNotificationCard` agora chama `setLastRomImportJob(null)` no dismiss
- Sem mudanças em IPC channels, schema SQLite, preload API ou main process
