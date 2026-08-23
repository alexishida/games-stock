# game-library Specification

## Purpose
Definir a persistencia e as operacoes da biblioteca de jogos, incluindo metadados, filtros, ordenacao, historico de partidas, agrupamento de variantes e importacao sem duplicidade indevida.

## Requirements
### Requirement: Modelo de dados de jogo

O sistema SHALL persistir jogos com metadados de biblioteca, referencias de midia, `rom_path`, `launchbox_id`, status de colecao e `launch_count`.

#### Scenario: Criacao minima

- **WHEN** o usuario cria um jogo com titulo e plataforma
- **THEN** o registro e salvo com `favorite = false`, `play_status = "unplayed"` e `launch_count = 0`

#### Scenario: Titulo ausente

- **WHEN** o usuario tenta criar um jogo sem `title`
- **THEN** o sistema retorna erro de validacao

### Requirement: CRUD e consultas via IPC

O namespace `window.gameStockAPI.games` SHALL expor `list`, `listGenres`, `get`, `create`, `update`, `delete`, `listMedia`, `listVersions`, `collectionCounts`, `launchStats`, `coverStats`, `syncCovers`, `resetLaunchStats` e `launch`.

#### Scenario: Listar por filtros

- **WHEN** `games.list()` recebe filtros de plataforma, busca, genero, colecao, ordenacao e pagina
- **THEN** a API retorna somente os jogos que atendem aos criterios

#### Scenario: Listar generos

- **WHEN** `games.listGenres()` e chamado
- **THEN** a API retorna os generos distintos usados pela biblioteca atual

### Requirement: Filtros e ordenacoes suportados

O sistema SHALL suportar os filtros de colecao `all`, `favorites`, `playing`, `completed`, `unplayed` e `mostPlayed`, alem das ordenacoes `title`, `year`, `recent` e `mostPlayed`.

#### Scenario: Colecao mais jogados

- **WHEN** `collectionFilter = "mostPlayed"`
- **THEN** a consulta retorna apenas jogos com `launch_count > 0`, ordenados do mais jogado para o menos jogado

#### Scenario: Ordenar por mais jogados

- **WHEN** `sortBy = "mostPlayed"`
- **THEN** a consulta usa `launch_count DESC` com titulo como desempate

### Requirement: Listagem paginada com contagens

O sistema SHALL retornar `items`, `total` e `filtered`, com pagina padrao de 36 itens.

#### Scenario: Resposta paginada

- **WHEN** a consulta usa `page` e `pageSize`
- **THEN** a API devolve apenas a faixa solicitada e informa totais bruto e filtrado

### Requirement: Midia local opcional

O sistema SHALL persistir `box_art_path`, `background_path` e `screenshot_path` como caminhos locais opcionais dentro do armazenamento do app.

#### Scenario: Jogo sem todas as imagens

- **WHEN** uma importacao encontra apenas parte da midia
- **THEN** o jogo continua sendo salvo e os caminhos ausentes permanecem nulos

### Requirement: Variantes relacionadas e deduplicacao

O sistema SHALL evitar duplicatas reais por `launchbox_id + plataforma`, mas preservar variantes com ROMs diferentes quando elas representarem versoes distintas do mesmo jogo.

#### Scenario: Duplicata real na mesma plataforma

- **WHEN** um candidato corresponde ao mesmo `launchbox_id` e mesma plataforma
- **THEN** o sistema atualiza o registro existente em vez de criar outro

#### Scenario: Variantes com ROMs diferentes

- **WHEN** dois registros compartilham `launchbox_id` mas apontam para ROMs diferentes
- **THEN** o sistema preserva as variantes separadas e pode desvincular `launchbox_id` duplicado da variante antiga

#### Scenario: Listar versoes relacionadas

- **WHEN** `games.listVersions(gameId)` e chamado
- **THEN** a API retorna variantes jogaveis agrupadas pelo titulo-base para uso no fluxo de launch
