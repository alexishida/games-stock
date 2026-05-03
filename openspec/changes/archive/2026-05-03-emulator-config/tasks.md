## 1. Banco de dados

- [x] 1.1 Adicionar `CREATE TABLE IF NOT EXISTS emulators` em `database.ts` com campos `id`, `name` (UNIQUE), `executable`, `args`, `is_retroarch`, `created_at`
- [x] 1.2 Adicionar `CREATE TABLE IF NOT EXISTS platform_emulators` com PK composta `(platform_id, emulator_id)`, FK cascades, `is_default` e `core_path`
- [x] 1.3 Adicionar trigger SQLite que zera `is_default` dos outros emuladores da plataforma ao setar um novo padrão
- [x] 1.4 Adicionar seed do RetroArch: `INSERT OR IGNORE INTO emulators (name, executable, is_retroarch) VALUES ('RetroArch', '', 1)`
- [x] 1.5 Adicionar tipos `Emulator` e `PlatformEmulator` em `src/shared/types.ts`

## 2. DAO e Repositório

- [x] 2.1 Criar `src/main/db/dao/emulatorDao.ts` com `list()`, `create()`, `update()`, `delete()`, `get()`
- [x] 2.2 Criar `src/main/db/dao/platformEmulatorDao.ts` com `listByPlatform()`, `link(emulatorId, platformId, isDefault, corePath?)`, `unlink()`, `getDefault()`
- [x] 2.3 Criar `src/main/db/repositories/emulators.ts` como facade dos dois DAOs

## 3. IPC

- [x] 3.1 Adicionar canais `emulators:list`, `emulators:create`, `emulators:update`, `emulators:delete`, `emulators:linkPlatform` (com `corePath?`), `emulators:unlinkPlatform`, `emulators:listByPlatform` em `src/shared/ipc-channels.ts`
- [x] 3.2 Adicionar canal `games:launch` em `src/shared/ipc-channels.ts`
- [x] 3.3 Registrar handlers de emuladores em `src/main/index.ts`
- [x] 3.4 Registrar handler `games:launch` em `src/main/index.ts` com lógica bifurcada: standalone → `spawn(exe, [...args, rom])`; RetroArch → `spawn(exe, ['-L', corePath, rom])`; validar ROM path, executável e core (se RetroArch)
- [x] 3.5 Expor `window.gameStockAPI.emulators` em `src/preload/index.ts`
- [x] 3.6 Expor `window.gameStockAPI.games.launch` em `src/preload/index.ts`
- [x] 3.7 Adicionar tipos correspondentes em `src/preload/types.d.ts`

## 4. UI — Gerenciamento de emuladores

- [x] 4.1 Criar componente `EmulatorsSettings` (lista + botão "Novo emulador") em `src/renderer/components/EmulatorsSettings/`
- [x] 4.2 Criar modal flutuante arrastável `EmulatorFormModal` para criar/editar emulador (campos: nome, executável, argumentos)
- [x] 4.3 Criar seção de associações plataforma↔emulador dentro de `EmulatorsSettings` (select de plataforma + select de emulador + botão vincular como padrão); exibir campo "Core" quando emulador selecionado tiver `is_retroarch = 1`
- [x] 4.6 Validar campo "Core" obrigatório ao salvar associação com RetroArch na UI
- [x] 4.4 Adicionar seção "Emuladores" no `SettingsModal` renderizando `EmulatorsSettings`
- [x] 4.5 Atualizar lista de plataformas no `SettingsModal` para exibir nome do emulador padrão de cada plataforma

## 6. Correções e proteções

- [x] 6.1 Bloquear deleção de RetroArch no `EmulatorDao.delete()` com erro "RetroArch não pode ser removido"
- [x] 6.2 Ocultar botão "Remover" na UI para emuladores com `is_retroarch = 1`
- [x] 6.3 Adicionar canal `dialogs:openExecutableFile` (filtro `.exe/.bat/.cmd/.sh`) para browse do campo "Executável"
- [x] 6.4 Adicionar canal `dialogs:openAnyFile` (sem filtro) para browse do campo "Core"
- [x] 6.5 Substituir `openRomFile` por `openExecutableFile` no browse do executável e `openAnyFile` no browse do core

## 5. UI — Lançamento de jogos

- [x] 5.1 Adicionar botão "Jogar" (ícone play) no card/linha de cada jogo na grade da biblioteca
- [x] 5.2 Desabilitar botão quando jogo não tem `rom_path` ou plataforma não tem emulador padrão, com tooltip explicativo
- [x] 5.3 Chamar `window.gameStockAPI.games.launch(gameId)` ao clicar e exibir erro via toast/notificação se falhar
