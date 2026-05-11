## 1. Remover writes hot-path do SQLite (store)

- [x] 1.1 Em `src/renderer/store/index.ts`, remover `void setPersistedLastRomImportJob(nextJob)` de dentro de `updateRomImportProgress`
- [x] 1.2 Em `src/renderer/store/index.ts`, remover `void setPersistedMediaSyncJobs(updated)` de dentro de `updateMediaSyncProgress`
- [x] 1.3 Em `src/renderer/store/index.ts`, remover `void setPersistedDataPortabilityJobs(updated)` de dentro de `updateDataPortabilityProgress`
- [x] 1.4 Em `src/renderer/store/index.ts`, remover `void setPersistedLastRomImportJob(nextJob)` de dentro de `hydrateRomImportJobs`

## 2. Corrigir dismiss de ROM import notification

- [x] 2.1 Em `src/renderer/components/NotificationCenter/NotificationCenter.tsx`, em `RomNotificationCard`, extrair `setLastRomImportJob` do store
- [x] 2.2 Criar `handleDismiss()` que chama `setLastRomImportJob(null)` seguido de `onDismiss()`
- [x] 2.3 Substituir `onClick={onDismiss}` do botão X da ROM card por `onClick={handleDismiss}`

## 3. Atualizar RULES.md

- [x] 3.1 Adicionar regra de persistência de jobs em `.ai-framework/RULES.md`: progress ticks só atualizam Zustand em memória; persistir apenas em job start, terminal transitions e dismiss
