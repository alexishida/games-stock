## MODIFIED Requirements

### Requirement: CRUD de emuladores via IPC

O sistema SHALL expor via `window.gameStockAPI.emulators` os métodos `list()`, `create(data)`, `update(id, data)` e `delete(id)`. O método `list()` SHALL retornar todos os emuladores. O campo `executable` SHALL aceitar caminho absoluto, caminho relativo ou nome de comando resolvível via `PATH`, preservando o valor informado pelo usuário. Emuladores com `is_retroarch = 1` SHALL ser protegidos contra exclusão.

#### Scenario: Listar emuladores

- **WHEN** `emulators.list()` é chamado
- **THEN** retorna todos os emuladores ordenados por nome, cada um com seus campos completos

#### Scenario: Salvar emulador com comando do PATH

- **WHEN** `emulators.create({ name, executable: "retroarch", ... })` é chamado
- **THEN** o sistema persiste o valor `retroarch` sem exigir separador de caminho no campo `executable`

#### Scenario: Deletar emulador com associações

- **WHEN** `emulators.delete(id)` é chamado em emulador associado a plataformas
- **THEN** as associações são removidas em cascata e o emulador é excluído

#### Scenario: Tentar deletar RetroArch via IPC

- **WHEN** `emulators.delete(id)` é chamado em emulador com `is_retroarch = 1`
- **THEN** o sistema retorna erro "RetroArch não pode ser removido"

### Requirement: UI de gerenciamento de emuladores no SettingsModal

O sistema SHALL fornecer dentro do SettingsModal uma seção "Emuladores" com lista de emuladores, botão "Novo emulador" e ações inline de editar/excluir. Criar e editar SHALL abrir em modal flutuante arrastável conforme padrão do projeto. O seletor de executável SHALL sempre oferecer opção "Todos os arquivos" e filtros compatíveis com o sistema operacional atual. A UI de cores do RetroArch SHALL exibir labels compatíveis com a plataforma atual, sem assumir extensão `.dll`.

#### Scenario: Criar emulador pela UI

- **WHEN** o usuário preenche nome, caminho do executável e (opcionalmente) argumentos e salva
- **THEN** o emulador aparece na lista de emuladores

#### Scenario: Editar emulador pela UI

- **WHEN** o usuário clica em editar, altera campos e salva
- **THEN** o emulador é atualizado na lista

#### Scenario: Excluir emulador pela UI

- **WHEN** o usuário clica em excluir e confirma
- **THEN** o emulador é removido da lista e desassociado de todas as plataformas

#### Scenario: Botão excluir ausente para RetroArch

- **WHEN** a lista de emuladores é exibida e um emulador tem `is_retroarch = 1`
- **THEN** o botão de excluir não é renderizado para esse emulador

#### Scenario: Selecionar executável do emulador no Linux

- **WHEN** o usuário clica no botão de pasta no campo "Executável" em Linux
- **THEN** abre diálogo de arquivo com opção "Todos os arquivos" e filtros de conveniência compatíveis com Linux, incluindo `.sh` e `.AppImage`, sem impedir que binários sem extensão sejam informados manualmente

#### Scenario: Associar emulador standalone a plataforma pela UI

- **WHEN** o usuário seleciona uma plataforma e vincula um emulador standalone como padrão
- **THEN** o emulador aparece como padrão da plataforma na seção de associações

#### Scenario: Associar RetroArch a plataforma sem campo de core

- **WHEN** o usuário seleciona RetroArch como emulador de uma plataforma
- **THEN** o formulário de associação exibe somente plataforma e opção de emulador padrão

#### Scenario: Salvar associação RetroArch

- **WHEN** o usuário salva a associação do RetroArch com uma plataforma
- **THEN** o sistema salva a associação sem exigir core

#### Scenario: Exibir core RetroArch em Linux

- **WHEN** o inventário de cores do RetroArch contém `snes9x_libretro.so` em Linux
- **THEN** a interface exibe o core com extensão compatível com Linux ou o caminho configurado pelo usuário, sem trocar o rótulo para `.dll`
