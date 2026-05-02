# platform-manager - Especificação

## Purpose
Define cadastro, listagem, agrupamento e gerenciamento visual de plataformas usadas pela biblioteca.

## Requirements
### Requirement: Modelo de dados de plataforma com categoria
O sistema SHALL persistir plataformas com `id`, `name`, `category` e `created_at`. O campo `name` SHALL ser UNIQUE. Plataformas SHALL ser agrupadas por `category` na árvore lateral.

#### Scenario: Plataformas pré-carregadas
- **WHEN** o banco é criado pela primeira vez
- **THEN** as seguintes plataformas padrão são inseridas: Sega Genesis (Consoles), Nintendo 64 (Consoles), Sega Saturn (Consoles), Game Boy (Portáteis), Super Nintendo (Consoles) e NES (Consoles)

#### Scenario: Plataforma com nome duplicado
- **WHEN** o usuário tenta criar plataforma com nome já existente
- **THEN** o sistema retorna erro "Plataforma já existe"

### Requirement: CRUD de plataformas via IPC
O sistema SHALL expor via `window.gameStockAPI.platforms` os métodos `list()`, `create(data)`, `update(id, data)` e `delete(id)`. `list()` SHALL retornar plataformas com o campo `gameCount` calculado via LEFT JOIN.

#### Scenario: Listar plataformas com contagem
- **WHEN** `platforms.list()` é chamado
- **THEN** retorna plataformas ordenadas por categoria e nome, cada uma com `gameCount`

#### Scenario: Deletar plataforma com jogos
- **WHEN** `platforms.delete(id)` é chamado em plataforma que possui jogos
- **THEN** retorna erro "Não é possível remover plataforma com jogos associados"

### Requirement: Categorias de plataforma
O sistema SHALL aceitar as categorias "Console", "Portátil" e "PC" no formulário de criação e edição de plataformas.

#### Scenario: Criar plataforma com categoria válida
- **WHEN** o usuário informa nome e seleciona uma das categorias disponíveis e salva
- **THEN** a plataforma é criada com a categoria correta e aparece agrupada na árvore lateral

### Requirement: Seleção "Todos" na árvore de plataformas
O sistema SHALL suportar um item especial "Todos" que lista jogos de todas as plataformas sem filtro.

#### Scenario: Seleção de Todos
- **WHEN** o usuário clica em "Todos"
- **THEN** a grade exibe todos os jogos do banco, independente de plataforma

### Requirement: UI de gerenciamento de plataformas (PlatformManager)
O sistema SHALL fornecer dentro do SettingsModal uma lista completa de plataformas com botão "Nova plataforma" e ações de editar/excluir por linha. Criar e editar SHALL abrir em modais sobrepostos independentes (PlatformFormModal), separados da lista principal.

#### Scenario: Criar plataforma pela UI
- **WHEN** o usuário clica em "Nova plataforma" e informa nome e categoria válidos e salva
- **THEN** a plataforma é criada, aparece na lista e fica disponível na árvore lateral e no formulário de jogos

#### Scenario: Editar plataforma pela UI
- **WHEN** o usuário clica no ícone de lápis de uma plataforma, altera nome ou categoria e salva
- **THEN** a plataforma é atualizada na lista e na árvore lateral; fechar ou cancelar o modal descarta a edição

#### Scenario: Excluir plataforma sem jogos
- **WHEN** o usuário clica no ícone de lixeira de uma plataforma sem jogos e confirma o diálogo
- **THEN** a plataforma é removida da lista e da árvore lateral

#### Scenario: Excluir plataforma com jogos
- **WHEN** o usuário tenta excluir plataforma com `gameCount > 0`
- **THEN** o sistema exibe a mensagem de validação e mantém a plataforma
