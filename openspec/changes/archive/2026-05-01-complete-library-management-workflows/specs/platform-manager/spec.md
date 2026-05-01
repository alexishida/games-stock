# platform-manager - Especificação

## Purpose
Define cadastro, listagem, agrupamento e gerenciamento visual de plataformas usadas pela biblioteca.

## Requirements
### Requirement: Modelo de dados de plataforma com categoria
O sistema SHALL persistir plataformas com `id`, `name`, `category` e `created_at`. Plataformas SHALL ser agrupadas por `category` na UI.

#### Scenario: Plataformas pré-carregadas
- **WHEN** o banco é criado pela primeira vez
- **THEN** as plataformas padrão são inseridas: Sega Genesis, Nintendo 64, Sega Saturn, Game Boy, SNES e NES

#### Scenario: Plataforma com nome duplicado
- **WHEN** o usuário tenta criar plataforma com nome já existente
- **THEN** o sistema retorna erro "Plataforma já existe"

### Requirement: CRUD de plataformas via IPC
O sistema SHALL expor via `window.gameStockAPI.platforms` os métodos `list()`, `create(data)`, `update(id, data)` e `delete(id)`. `list()` SHALL retornar `gameCount`.

#### Scenario: Listar plataformas com contagem
- **WHEN** `platforms.list()` é chamado
- **THEN** retorna plataformas ordenadas por categoria e nome, cada uma com `gameCount`

#### Scenario: Deletar plataforma com jogos
- **WHEN** `platforms.delete(id)` é chamado em plataforma que possui jogos
- **THEN** retorna erro "Não é possível remover plataforma com jogos associados"

### Requirement: Seleção "Todos" na árvore de plataformas
O sistema SHALL suportar um item especial "Todos" que lista jogos de todas as plataformas sem filtro.

#### Scenario: Seleção de Todos
- **WHEN** o usuário clica em "Todos"
- **THEN** a grade exibe todos os jogos do banco

### Requirement: UI de gerenciamento de plataformas
O sistema SHALL fornecer interface para listar, criar, editar e excluir plataformas usando as validações existentes do IPC.

#### Scenario: Criar plataforma pela UI
- **WHEN** o usuário informa nome e categoria válidos e salva
- **THEN** a plataforma é criada, aparece na árvore lateral e fica disponível para jogos manuais

#### Scenario: Editar plataforma pela UI
- **WHEN** o usuário altera nome ou categoria e salva
- **THEN** a plataforma é atualizada na árvore lateral e nos jogos associados

#### Scenario: Excluir plataforma sem jogos
- **WHEN** o usuário exclui uma plataforma sem jogos e confirma
- **THEN** a plataforma é removida da árvore lateral

#### Scenario: Excluir plataforma com jogos
- **WHEN** o usuário tenta excluir plataforma com jogos associados
- **THEN** o sistema exibe a mensagem de validação e mantém a plataforma
