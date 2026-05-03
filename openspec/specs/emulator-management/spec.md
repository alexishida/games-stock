# emulator-management - Especificação

## Purpose
Gerenciamento de emuladores e associação com plataformas, incluindo suporte nativo ao RetroArch sem configuração de core por plataforma.

## Requirements

### Requirement: Modelo de dados de emulador
O sistema SHALL persistir emuladores com `id`, `name` (UNIQUE), `executable` (caminho do executável), `args` (argumentos padrão, pode ser vazio), `is_retroarch` (flag booleano) e `created_at`. A tabela `platform_emulators` SHALL associar emuladores a plataformas com flag `is_default`; o campo legado opcional `core_path`, quando existir, SHALL poder ficar nulo. O banco SHALL conter um registro padrão de RetroArch com `is_retroarch = 1` e `executable` vazio.

#### Scenario: Criar emulador com nome duplicado
- **WHEN** o usuário tenta criar um emulador com nome já existente
- **THEN** o sistema retorna erro "Emulador já existe"

#### Scenario: Associar emulador como padrão
- **WHEN** um emulador é marcado como padrão para uma plataforma
- **THEN** qualquer outro emulador anteriormente padrão nessa plataforma perde o flag `is_default`

#### Scenario: Seed RetroArch presente no banco novo
- **WHEN** o banco é criado pela primeira vez
- **THEN** existe um registro em `emulators` com `name = 'RetroArch'` e `is_retroarch = 1`

### Requirement: CRUD de emuladores via IPC
O sistema SHALL expor via `window.gameStockAPI.emulators` os métodos `list()`, `create(data)`, `update(id, data)` e `delete(id)`. O método `list()` SHALL retornar todos os emuladores. Emuladores com `is_retroarch = 1` SHALL ser protegidos contra exclusão.

#### Scenario: Listar emuladores
- **WHEN** `emulators.list()` é chamado
- **THEN** retorna todos os emuladores ordenados por nome, cada um com seus campos completos

#### Scenario: Deletar emulador com associações
- **WHEN** `emulators.delete(id)` é chamado em emulador associado a plataformas
- **THEN** as associações são removidas em cascata e o emulador é excluído

#### Scenario: Tentar deletar RetroArch via IPC
- **WHEN** `emulators.delete(id)` é chamado em emulador com `is_retroarch = 1`
- **THEN** o sistema retorna erro "RetroArch não pode ser removido"

### Requirement: Gerenciamento de associações plataforma-emulador via IPC
O sistema SHALL expor via `window.gameStockAPI.emulators` os métodos `linkPlatform(emulatorId, platformId, isDefault, corePath?)`, `unlinkPlatform(emulatorId, platformId)` e `listByPlatform(platformId)`. O parâmetro `corePath` é opcional e não SHALL ser exigido para RetroArch.

#### Scenario: Vincular emulador standalone a plataforma
- **WHEN** `emulators.linkPlatform(emulatorId, platformId, true)` é chamado para emulador com `is_retroarch = 0`
- **THEN** a associação é criada sem `core_path` e o emulador se torna padrão da plataforma

#### Scenario: Vincular RetroArch a plataforma sem core
- **WHEN** `emulators.linkPlatform(retroarchId, platformId, true)` é chamado
- **THEN** a associação é criada com `core_path` nulo e RetroArch se torna padrão da plataforma

#### Scenario: Listar emuladores de uma plataforma
- **WHEN** `emulators.listByPlatform(platformId)` é chamado
- **THEN** retorna emuladores associados à plataforma com `is_default` e dados do emulador de cada um

### Requirement: UI de gerenciamento de emuladores no SettingsModal
O sistema SHALL fornecer dentro do SettingsModal uma seção "Emuladores" com lista de emuladores, botão "Novo emulador" e ações inline de editar/excluir. Criar e editar SHALL abrir em modal flutuante arrastável conforme padrão do projeto.

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

#### Scenario: Selecionar executável do emulador
- **WHEN** o usuário clica no botão de pasta no campo "Executável"
- **THEN** abre diálogo de arquivo filtrado por executáveis (`.exe`, `.bat`, `.cmd`, `.sh`) com opção "Todos os arquivos"

#### Scenario: Associar emulador standalone a plataforma pela UI
- **WHEN** o usuário seleciona uma plataforma e vincula um emulador standalone como padrão
- **THEN** o emulador aparece como padrão da plataforma na seção de associações

#### Scenario: Associar RetroArch a plataforma sem campo de core
- **WHEN** o usuário seleciona RetroArch como emulador de uma plataforma
- **THEN** o formulário de associação exibe somente plataforma e opção de emulador padrão

#### Scenario: Salvar associação RetroArch
- **WHEN** o usuário salva a associação do RetroArch com uma plataforma
- **THEN** o sistema salva a associação sem exigir core
