## Why

GameStock tem plataformas mas nenhuma forma de associar emuladores a elas. Sem isso, não é possível lançar jogos — o usuário precisa sair do app para abrir o emulador manualmente. Esta mudança fecha essa lacuna central.

## What Changes

- Novo modelo de dados `emulators` no SQLite: nome, executável, argumentos padrão e flag `is_retroarch`
- Associação N:M entre emuladores e plataformas (`platform_emulators`), com flag de emulador padrão por plataforma e campo `core_path` para uso com RetroArch
- Seed de emulador RetroArch padrão no banco (executável configurável pelo usuário)
- CRUD completo de emuladores via IPC (`window.gameStockAPI.emulators`)
- UI de gerenciamento de emuladores no SettingsModal: ao vincular RetroArch a uma plataforma, exibe campo adicional para o caminho do core
- Ao lançar um jogo, o sistema bifurca: emulador standalone (`exe args rom`) ou RetroArch (`retroarch -L core rom`)

## Capabilities

### New Capabilities

- `emulator-management`: CRUD de emuladores (nome, caminho do executável, argumentos, flag RetroArch) e associação com plataformas, incluindo emulador padrão por plataforma e core RetroArch por associação
- `game-launch`: Lançamento de jogos a partir da biblioteca usando o emulador configurado para a plataforma do jogo

### Modified Capabilities

- `platform-manager`: Plataforma agora exibe emuladores associados e permite vincular/desvincular emuladores

## Impact

- **DB**: Novas tabelas `emulators` (com `is_retroarch`) e `platform_emulators` (com `core_path`); seed do RetroArch; migration no `database.ts`
- **DAOs**: `src/main/db/dao/emulators.ts`, `src/main/db/dao/platform-emulators.ts`
- **IPC**: Novos canais em `ipc-channels.ts`; handlers em `main/index.ts`; exposição em `preload/index.ts` + `types.d.ts`
- **UI**: Novo componente `EmulatorsSettings` dentro do `SettingsModal`; botão "Launch" na grade de jogos
- **Zustand**: Nenhum estado global novo necessário; lançamento é ação pontual
