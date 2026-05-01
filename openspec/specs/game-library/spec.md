# game-library Specification

## Purpose
TBD - created by archiving change create-game-stock-app. Update Purpose after archive.
## Requirements
### Requirement: Modelo de dados de jogo
O sistema SHALL persistir jogos com os campos: `id` (integer PK), `title` (text, obrigatório), `platform_id` (FK → platforms), `publisher` (text), `year` (integer), `genre` (text), `rating` (text, ex: "E", "T", "M"), `box_art_path` (text, caminho absoluto local), `rom_path` (text, caminho absoluto), `owned_physical` (boolean, default false), `physical_condition` (text), `notes` (text), `created_at`, `updated_at`.

#### Scenario: Criação de jogo com campos mínimos
- **WHEN** o usuário cria um jogo com apenas `title` e `platform_id`
- **THEN** o jogo é salvo com os demais campos como null/default

#### Scenario: Jogo sem plataforma
- **WHEN** o usuário tenta criar um jogo sem `title`
- **THEN** o sistema retorna erro de validação "Título é obrigatório"

### Requirement: CRUD de jogos via IPC
O sistema SHALL expor via `window.gameStockAPI.games`: `list(filters?)`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)`. Todas as operações SHALL retornar Promises resolvidas com os dados ou erro tipado.

#### Scenario: Listar jogos com filtro de plataforma
- **WHEN** `games.list({ platformId: 3 })` é chamado
- **THEN** retorna array de jogos pertencentes à plataforma 3, ordenados por título

#### Scenario: Listar jogos com busca textual
- **WHEN** `games.list({ search: "batman" })` é chamado
- **THEN** retorna jogos cujo título contém "batman" (case-insensitive)

#### Scenario: Deletar jogo
- **WHEN** `games.delete(id)` é chamado com um ID existente
- **THEN** o jogo é removido do banco e retorna `{ success: true }`

### Requirement: Listagem com contagem
O sistema SHALL retornar junto com a lista de jogos o total de jogos correspondentes aos filtros ativos, para exibição do contador "Exibindo X de Y total de jogos".

#### Scenario: Contagem com filtro
- **WHEN** `games.list({ platformId: 2 })` retorna 104 jogos de um total de 541
- **THEN** a resposta contém `{ items: [...], total: 541, filtered: 104 }`

