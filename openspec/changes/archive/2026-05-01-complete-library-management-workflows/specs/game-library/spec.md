## MODIFIED Requirements

### Requirement: Modelo de dados de jogo
O sistema SHALL persistir jogos com os campos: `id` (integer PK), `title` (text, obrigatorio), `platform_id` (FK -> platforms), `publisher` (text), `year` (integer), `genre` (text), `rating` (text, ex: "E", "T", "M"), `box_art_path` (text, caminho absoluto local), `rom_path` (text, caminho absoluto), `owned_physical` (boolean, default false), `physical_condition` (text), `favorite` (boolean, default false), `play_status` (text, default "unplayed", valores "unplayed", "playing", "completed"), `notes` (text), `created_at`, `updated_at`.

#### Scenario: Criação de jogo com campos mínimos
- **WHEN** o usuário cria um jogo com apenas `title` e `platform_id`
- **THEN** o jogo é salvo com os demais campos como null/default, `favorite = false` e `play_status = "unplayed"`

#### Scenario: Jogo sem título
- **WHEN** o usuário tenta criar um jogo sem `title`
- **THEN** o sistema retorna erro de validação "Título é obrigatório"

### Requirement: CRUD de jogos via IPC
O sistema SHALL expor via `window.gameStockAPI.games`: `list(filters?)`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)`. Todas as operações SHALL retornar Promises resolvidas com os dados ou erro tipado. O método `list(filters?)` SHALL aceitar filtros de plataforma, busca textual, inventário físico e coleção, além de ordenação por título, ano ou recentes.

#### Scenario: Listar jogos com filtro de plataforma
- **WHEN** `games.list({ platformId: 3 })` é chamado
- **THEN** retorna array de jogos pertencentes à plataforma 3, ordenados por título por padrão

#### Scenario: Listar jogos com busca textual
- **WHEN** `games.list({ search: "batman" })` é chamado
- **THEN** retorna jogos cujo título contém "batman" (case-insensitive)

#### Scenario: Listar favoritos
- **WHEN** `games.list({ collectionFilter: "favorites" })` é chamado
- **THEN** retorna apenas jogos com `favorite = true`

#### Scenario: Listar concluídos
- **WHEN** `games.list({ collectionFilter: "completed" })` é chamado
- **THEN** retorna apenas jogos com `play_status = "completed"`

#### Scenario: Ordenar por ano
- **WHEN** `games.list({ sortBy: "year" })` é chamado
- **THEN** retorna jogos ordenados por ano, mantendo títulos como desempate

#### Scenario: Deletar jogo
- **WHEN** `games.delete(id)` é chamado com um ID existente
- **THEN** o jogo é removido do banco e retorna `{ success: true }`
