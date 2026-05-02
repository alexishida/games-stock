# game-library - Especificação

## Purpose
Define a persistência e as operações de biblioteca para jogos, incluindo metadados, filtros com paginação, ordenação, mídia baixada e importação em lote sem duplicidade.

## Requirements
### Requirement: Modelo de dados de jogo
O sistema SHALL persistir jogos com os campos `id`, `title`, `platform_id`, `publisher`, `year`, `genre`, `rating`, `box_art_path`, `background_path`, `screenshot_path`, `rom_path`, `favorite`, `play_status`, `notes`, `launchbox_id`, `created_at` e `updated_at`. O campo `favorite` SHALL ser booleano (0/1) com default 0. O campo `play_status` SHALL aceitar os valores `"unplayed"`, `"playing"` e `"completed"` com default `"unplayed"`.

#### Scenario: Criação de jogo com campos mínimos
- **WHEN** o usuário cria um jogo com apenas `title` e `platform_id`
- **THEN** o jogo é salvo com os demais campos como null/default, `favorite = false` e `play_status = "unplayed"`

#### Scenario: Jogo sem título
- **WHEN** o usuário tenta criar um jogo sem `title`
- **THEN** o sistema retorna erro de validação "Título é obrigatório"

### Requirement: CRUD de jogos via IPC
O sistema SHALL expor via `window.gameStockAPI.games` os métodos `list(filters?)`, `get(id)`, `create(data)`, `update(id, data)` e `delete(id)`. O método `list(filters?)` SHALL aceitar filtros de plataforma, busca textual, coleção, ordenação e paginação.

#### Scenario: Listar jogos com filtro de plataforma
- **WHEN** `games.list({ platformId: 3 })` é chamado
- **THEN** retorna jogos pertencentes à plataforma 3, ordenados por título por padrão

#### Scenario: Listar jogos com busca textual
- **WHEN** `games.list({ search: "batman" })` é chamado
- **THEN** retorna jogos cujo título contém "batman" de forma case-insensitive

#### Scenario: Listar favoritos
- **WHEN** `games.list({ collectionFilter: "favorites" })` é chamado
- **THEN** retorna apenas jogos com `favorite = true`

#### Scenario: Listar concluídos
- **WHEN** `games.list({ collectionFilter: "completed" })` é chamado
- **THEN** retorna apenas jogos com `play_status = "completed"`

#### Scenario: Listar não jogados
- **WHEN** `games.list({ collectionFilter: "unplayed" })` é chamado
- **THEN** retorna apenas jogos com `play_status = "unplayed"`

#### Scenario: Ordenar por ano
- **WHEN** `games.list({ sortBy: "year" })` é chamado
- **THEN** retorna jogos ordenados por ano, mantendo título como desempate

#### Scenario: Ordenar por recentes
- **WHEN** `games.list({ sortBy: "recent" })` é chamado
- **THEN** retorna jogos ordenados por `updated_at` decrescente

#### Scenario: Deletar jogo
- **WHEN** `games.delete(id)` é chamado com um ID existente
- **THEN** o jogo é removido do banco e retorna `{ success: true }`

### Requirement: Listagem paginada com contagem
O sistema SHALL retornar junto com a lista de jogos o total geral e o total filtrado, com suporte a paginação via `page` e `pageSize`. O `pageSize` padrão SHALL ser 50 itens por página.

#### Scenario: Contagem com filtro
- **WHEN** `games.list({ platformId: 2 })` retorna 104 jogos de um total de 541
- **THEN** a resposta contém `{ items: [...], total: 541, filtered: 104 }`

#### Scenario: Paginação
- **WHEN** `games.list({ page: 2, pageSize: 50 })` é chamado
- **THEN** a resposta contém os itens 51–100 do conjunto filtrado

### Requirement: Caminhos de mídia para jogos importados
O sistema SHALL persistir caminhos locais opcionais para box art, background e screenshot. Esses caminhos apontam para arquivos copiados no diretório de dados do app ou baixados da LaunchBox.

#### Scenario: Salvar caminhos de mídia importada
- **WHEN** um jogo é importado com box art, background e screenshot baixados
- **THEN** o registro salva a capa em `box_art_path`, o fundo em `background_path` e a captura em `screenshot_path`

#### Scenario: Mídia opcional ausente
- **WHEN** a LaunchBox não fornece background ou screenshot para um jogo encontrado
- **THEN** o jogo ainda é salvo e o caminho ausente permanece null

### Requirement: Upsert em lote a partir de importação de pasta de ROMs
O sistema SHALL criar ou atualizar múltiplos jogos a partir de uma importação por pasta sem duplicar o mesmo título e plataforma. A correspondência de duplicata SHALL usar `launchbox_id` + plataforma como chave primária, com fallback em título normalizado + plataforma.

#### Scenario: Criar jogo a partir da importação de ROM
- **WHEN** um candidato importado não possui jogo existente para o launchbox_id e a plataforma selecionada
- **THEN** o sistema cria o jogo com título, plataforma, caminho da ROM, metadados LaunchBox e caminhos de mídia baixada

#### Scenario: Atualizar jogo existente a partir da importação de ROM
- **WHEN** um candidato corresponde a jogo existente por launchbox_id e plataforma ou por título e plataforma
- **THEN** o sistema atualiza esse jogo com caminho da ROM, metadados recentes e caminhos de mídia, sem criar duplicata

#### Scenario: Reimportar a mesma pasta
- **WHEN** o usuário importa a mesma pasta e plataforma mais de uma vez
- **THEN** a segunda importação atualiza ou ignora jogos existentes e não cria registros duplicados
