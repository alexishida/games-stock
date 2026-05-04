# platform-manager - Especificação

## Purpose
Define cadastro, listagem, agrupamento e gerenciamento visual de plataformas usadas pela biblioteca.

## Requirements
### Requirement: Modelo de dados de plataforma com categoria
O sistema SHALL persistir plataformas com `id`, `name`, `category` e `created_at`. O campo `name` SHALL ser UNIQUE. Plataformas SHALL ser agrupadas por `category` na árvore lateral.

#### Scenario: Plataformas pré-carregadas
- **WHEN** o banco é criado pela primeira vez
- **THEN** plataformas padrão como Sega Mega Drive, Super Nintendo, Nintendo 64, Nintendo Entertainment System, Game Boy, Game Boy Advance, PlayStation e outras do catálogo inicial são inseridas automaticamente

#### Scenario: Plataforma com nome duplicado
- **WHEN** o usuário tenta criar plataforma com nome já existente
- **THEN** o sistema retorna erro "Plataforma já existe"

### Requirement: CRUD de plataformas via IPC
O sistema SHALL expor via `window.gameStockAPI.platforms` os métodos `list()`, `create(data)`, `update(id, data)`, `delete(id)`, `getMappings(platformId)` e `saveMappings(platformId, data)`. `list()` SHALL retornar plataformas com o campo `gameCount` calculado via LEFT JOIN.

#### Scenario: Listar plataformas com contagem
- **WHEN** `platforms.list()` é chamado
- **THEN** retorna plataformas ordenadas por categoria e nome, cada uma com `gameCount`

#### Scenario: Deletar plataforma com jogos
- **WHEN** `platforms.delete(id)` é chamado em plataforma que possui jogos
- **THEN** retorna erro "Não é possível remover plataforma com jogos associados"

### Requirement: Mapeamentos de aliases e extensões por plataforma
O sistema SHALL persistir aliases de busca e extensões de ROM por plataforma em tabelas dedicadas. Os aliases SHALL permitir casar nomes equivalentes usados por fontes externas de metadados, e as extensões SHALL definir quais arquivos são aceitos no importador de pasta para cada plataforma.

#### Scenario: Carregar mapeamentos de plataforma
- **WHEN** `platforms.getMappings(platformId)` é chamado
- **THEN** o sistema retorna listas de `aliases` e `romExtensions` vinculadas à plataforma

#### Scenario: Salvar aliases e extensões
- **WHEN** `platforms.saveMappings(platformId, data)` é chamado com aliases válidos e ao menos uma extensão principal
- **THEN** os mapeamentos anteriores da plataforma são substituídos pelos novos valores persistidos

#### Scenario: Bloquear plataforma sem alias
- **WHEN** `platforms.saveMappings(platformId, data)` é chamado sem nenhum alias preenchido
- **THEN** o sistema retorna erro informando que é necessário ao menos um alias

#### Scenario: Bloquear plataforma sem extensão principal
- **WHEN** `platforms.saveMappings(platformId, data)` é chamado sem nenhuma extensão marcada como principal
- **THEN** o sistema retorna erro informando que é necessário ao menos uma extensão principal

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

### Requirement: UI de aliases e extensões por plataforma
O sistema SHALL fornecer no PlatformManager uma ação por linha para abrir um modal de mapeamentos da plataforma. Esse modal SHALL permitir editar aliases e extensões de ROM, adicionando e removendo linhas dinamicamente.

#### Scenario: Abrir modal de mapeamentos
- **WHEN** o usuário clica na ação de aliases/extensões de uma plataforma
- **THEN** o modal "Vínculos de plataforma" abre carregando os aliases e extensões já persistidos

#### Scenario: Editar aliases pela UI
- **WHEN** o usuário adiciona ou remove aliases e salva o modal
- **THEN** os novos nomes equivalentes passam a ser usados nas buscas e correspondências de metadados da plataforma

#### Scenario: Editar extensões pela UI
- **WHEN** o usuário altera as extensões de ROM e salva o modal
- **THEN** o importador de pasta passa a aceitar apenas as extensões principais configuradas para essa plataforma

### Requirement: Exibição de emulador padrão na lista de plataformas
O sistema SHALL exibir na lista de plataformas do SettingsModal o nome do emulador padrão de cada plataforma (se configurado).

#### Scenario: Plataforma com emulador padrão
- **WHEN** a lista de plataformas é exibida e uma plataforma tem emulador padrão configurado
- **THEN** o nome do emulador padrão aparece ao lado ou abaixo do nome da plataforma

#### Scenario: Plataforma sem emulador padrão
- **WHEN** a lista de plataformas é exibida e uma plataforma não tem emulador padrão
- **THEN** exibe indicação visual de que nenhum emulador está configurado (ex: "—" ou "Nenhum")
