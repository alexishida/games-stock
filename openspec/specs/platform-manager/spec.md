# platform-manager Specification

## Purpose
TBD - created by archiving change create-game-stock-app. Update Purpose after archive.
## Requirements
### Requirement: Modelo de dados de plataforma com categoria
O sistema SHALL persistir plataformas com: `id` (integer PK), `name` (text, obrigatório, único), `category` (text, ex: "Consoles", "Portáteis", "Arcades", "PCs"), `created_at`. Plataformas SHALL ser agrupadas por `category` na UI.

#### Scenario: Plataformas pré-carregadas
- **WHEN** o banco é criado pela primeira vez
- **THEN** as plataformas padrão são inseridas: Sega Genesis (Consoles), Nintendo 64 (Consoles), Sega Saturn (Consoles), Game Boy (Portáteis), SNES (Consoles), NES (Consoles)

#### Scenario: Plataforma com nome duplicado
- **WHEN** o usuário tenta criar uma plataforma com nome já existente
- **THEN** o sistema retorna erro "Plataforma já existe"

### Requirement: CRUD de plataformas via IPC
O sistema SHALL expor via `window.gameStockAPI.platforms`: `list()`, `create(data)`, `update(id, data)`, `delete(id)`. O método `list()` SHALL retornar plataformas com o campo `gameCount` (número de jogos associados).

#### Scenario: Listar plataformas com contagem
- **WHEN** `platforms.list()` é chamado
- **THEN** retorna array de plataformas ordenadas por categoria e nome, cada uma com `gameCount`

#### Scenario: Deletar plataforma com jogos
- **WHEN** `platforms.delete(id)` é chamado em plataforma que possui jogos
- **THEN** retorna erro "Não é possível remover plataforma com jogos associados"

### Requirement: Seleção "Todos" na árvore de plataformas
O sistema SHALL suportar um item especial "Todos" na árvore que, quando selecionado, lista jogos de todas as plataformas sem filtro de plataforma.

#### Scenario: Seleção de Todos
- **WHEN** o usuário clica em "Todos" no painel lateral
- **THEN** a grade exibe todos os jogos do banco, sem filtro de plataforma

### Requirement: UI de gerenciamento de plataformas
O sistema SHALL fornecer uma interface de gerenciamento de plataformas acessível pelo menu ou por controle visível da biblioteca. A interface SHALL listar plataformas com categoria e contagem de jogos, permitir criar, editar e excluir plataformas, e SHALL usar as validações existentes do IPC.

#### Scenario: Criar plataforma pela UI
- **WHEN** o usuário informa nome e categoria válidos e salva uma nova plataforma
- **THEN** a plataforma é criada, aparece na árvore lateral e fica disponível para criação manual de jogos

#### Scenario: Editar plataforma pela UI
- **WHEN** o usuário altera o nome ou categoria de uma plataforma existente e salva
- **THEN** a plataforma é atualizada na árvore lateral e nos jogos associados

#### Scenario: Excluir plataforma sem jogos
- **WHEN** o usuário exclui uma plataforma sem jogos associados e confirma
- **THEN** a plataforma é removida e deixa de aparecer na árvore lateral

#### Scenario: Excluir plataforma com jogos
- **WHEN** o usuário tenta excluir uma plataforma que possui jogos associados
- **THEN** o sistema exibe a mensagem "Não é possível remover plataforma com jogos associados" e mantém a plataforma

