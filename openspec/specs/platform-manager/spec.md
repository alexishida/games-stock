# platform-manager Specification

## Purpose
Definir cadastro, listagem, categorizacao e gerenciamento visual de plataformas usadas pela biblioteca.

## Requirements
### Requirement: Modelo de dados de plataforma

O sistema SHALL persistir plataformas com `id`, `name`, `category`, `is_default` e `created_at`. O nome SHALL ser unico.

#### Scenario: Catalogo inicial

- **WHEN** o banco e criado pela primeira vez
- **THEN** o catalogo padrao de plataformas e inserido automaticamente com `is_default = 1`

#### Scenario: Nome duplicado

- **WHEN** o usuario tenta criar plataforma com nome ja existente
- **THEN** o sistema retorna erro de duplicidade

### Requirement: CRUD via IPC

O namespace `window.gameStockAPI.platforms` SHALL expor `list`, `create`, `update`, `delete`, `getMappings` e `saveMappings`.

#### Scenario: Listagem com contagem

- **WHEN** `platforms.list()` e chamado
- **THEN** a resposta inclui `gameCount` por plataforma

#### Scenario: Remocao bloqueada por regra de negocio

- **WHEN** o usuario tenta excluir plataforma default ou com jogos associados
- **THEN** o sistema bloqueia a remocao

### Requirement: Mapeamentos de aliases e extensoes

Cada plataforma SHALL manter aliases LaunchBox e extensoes de ROM em tabelas dedicadas.

#### Scenario: Salvar mappings validos

- **WHEN** o usuario salva aliases e extensoes com ao menos um alias e uma extensao principal
- **THEN** os mappings antigos da plataforma sao substituidos pelos novos

#### Scenario: Alias ausente

- **WHEN** nenhum alias valido e enviado
- **THEN** o sistema retorna erro

#### Scenario: Extensao principal ausente

- **WHEN** nenhuma extensao marcada como principal e enviada
- **THEN** o sistema retorna erro

### Requirement: Categorias de plataforma

O formulario do `PlatformManager` SHALL trabalhar com as categorias de UI `Console`, `Portatil` e `PC`, normalizando categorias legadas do catalogo conforme necessario.

#### Scenario: Plataforma criada pela UI

- **WHEN** o usuario informa nome e categoria valida
- **THEN** a plataforma aparece na lista do manager e passa a poder ser agrupada na sidebar

### Requirement: UI do PlatformManager

A secao `Plataformas` do SettingsModal SHALL listar plataformas, permitir criar/editar/excluir e mostrar o emulador padrao configurado quando houver.

#### Scenario: Exibir emulador padrao

- **WHEN** uma plataforma possui emulador padrao
- **THEN** esse emulador aparece na linha da plataforma

#### Scenario: Abrir modal de mappings

- **WHEN** o usuario escolhe editar aliases/extensoes de uma plataforma
- **THEN** o modal de vinculos carrega os dados atuais e permite salvar a nova configuracao
