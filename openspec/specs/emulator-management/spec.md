# emulator-management Specification

## Purpose
Gerenciar emuladores e associacoes por plataforma, incluindo RetroArch com configuracao de core por plataforma.

## Requirements
### Requirement: Modelo de dados de emulador

O sistema SHALL persistir emuladores com `id`, `name`, `executable`, `args`, `is_retroarch` e `created_at`. A tabela `platform_emulators` SHALL guardar `is_default` e `core_path` por plataforma.

#### Scenario: Seed do RetroArch

- **WHEN** o banco e criado pela primeira vez
- **THEN** o sistema garante um registro default `RetroArch` com `is_retroarch = 1`

#### Scenario: Default unico por plataforma

- **WHEN** um vinculo e salvo com `is_default = 1`
- **THEN** qualquer outro vinculo default da mesma plataforma perde essa flag

### Requirement: CRUD de emuladores via IPC

O sistema SHALL expor `list()`, `create()`, `update()` e `delete()` em `window.gameStockAPI.emulators`. O campo `executable` SHALL aceitar caminho absoluto, relativo ou nome resolvivel via `PATH`.

#### Scenario: Criar emulador com nome duplicado

- **WHEN** o usuario tenta salvar um nome ja existente
- **THEN** o sistema retorna erro de duplicidade

#### Scenario: Excluir RetroArch

- **WHEN** o usuario tenta remover um emulador com `is_retroarch = 1`
- **THEN** o sistema bloqueia a exclusao

### Requirement: Vinculos plataforma-emulador

O sistema SHALL expor `linkPlatform(emulatorId, platformId, isDefault, corePath?)`, `unlinkPlatform(emulatorId, platformId)`, `listByPlatform(platformId)` e `listRetroArchCores(emulatorId)`.

#### Scenario: Vincular emulador standalone

- **WHEN** um emulador comum e associado a uma plataforma
- **THEN** o vinculo pode ser salvo sem `core_path`

#### Scenario: Vincular RetroArch com core dedicado

- **WHEN** o usuario associa RetroArch a uma plataforma com um core selecionado
- **THEN** o vinculo persiste `core_path` para aquele par plataforma-emulador

#### Scenario: Inventario de cores instalados

- **WHEN** `listRetroArchCores(emulatorId)` e chamado
- **THEN** a API retorna se o executavel esta configurado, se `cores/` existe e os nomes de cores instalados

### Requirement: Fallback de resolucao de core no launch

O sistema SHALL permitir que o launch tente resolver o core do RetroArch por `core_path` configurado e, na ausencia dele, por candidatos derivados do nome da plataforma.

#### Scenario: Core configurado manualmente

- **WHEN** o vinculo possui `core_path`
- **THEN** esse caminho tem prioridade no launch

#### Scenario: Core nao configurado manualmente

- **WHEN** o vinculo do RetroArch nao possui `core_path`
- **THEN** o launch ainda tenta localizar um core compativel na pasta `cores/` com base na plataforma

### Requirement: UI de gerenciamento no SettingsModal

A secao `Emuladores` do SettingsModal SHALL listar emuladores, permitir criar/editar/excluir e manter uma area de associacoes por plataforma com suporte a cores do RetroArch.

#### Scenario: Dialogo de executavel

- **WHEN** o usuario abre o seletor de executavel
- **THEN** a UI oferece filtros compativeis com o sistema atual e sempre inclui `Todos os arquivos`

#### Scenario: Botao de excluir oculto para RetroArch

- **WHEN** a linha do RetroArch e renderizada
- **THEN** a acao de exclusao nao aparece

#### Scenario: Configurar core por plataforma

- **WHEN** o usuario gerencia os vinculos do RetroArch
- **THEN** a UI mostra cores recomendados e instalados, permitindo salvar um core especifico por plataforma
