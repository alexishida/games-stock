<!-- Contrato atual consolidado da implementação nativa; histórico preservado em changes/. -->
# game-library Specification

## Purpose
Definir a persistencia e as operacoes da biblioteca de jogos, incluindo metadados, filtros, ordenacao, historico de partidas, agrupamento de variantes e importacao sem duplicidade indevida.

## Requirements

### Requirement: Visualizador de midia e exportacao local

O sistema SHALL permitir ampliar capas e mídias da galeria do detalhe em overlay interno, navegar entre imagens e salvar uma cópia por diálogo nativo. A exportação SHALL aceitar somente imagens válidas do perfil, preservar os bytes e substituir atomicamente o destino escolhido, sem alterar a origem.

#### Scenario: Ampliar e navegar
- **WHEN** o usuário seleciona uma imagem da galeria ou a capa do detalhe
- **THEN** o visualizador abre com navegação anterior/próxima circular e opção de fechar, preservando o layout da página

#### Scenario: Salvar imagem
- **WHEN** o usuário escolhe Salvar imagem e confirma um destino local
- **THEN** o app copia a imagem autorizada ao destino e apresenta erro acionável se a cópia falhar

#### Scenario: Origem indevida
- **WHEN** uma exportação tenta ler arquivo fora do perfil ou conteúdo que não é imagem
- **THEN** a operação é recusada sem modificar um destino existente

### Requirement: Internalizacao de capa local

O sistema SHALL copiar uma imagem local selecionada para o diretório de imagens do perfil antes de associá-la ao jogo, preservando a origem. URLs de seleção SHALL ser decodificadas sem perder espaços, acentos ou caminhos de rede. Referências legadas indisponíveis SHALL permanecer preservadas durante edições de outros campos.

#### Scenario: Associar capa externa
- **WHEN** o usuário escolhe uma capa PNG, JPEG ou WebP fora do perfil
- **THEN** o app guarda uma cópia interna e associa seu caminho ao cadastro, tornando-a acessível ao provider autorizado

#### Scenario: Selecionar ROM com espaços e acentos
- **WHEN** o diálogo retorna a URL de uma ROM com esses caracteres
- **THEN** o cadastro recebe o caminho local decodificado, sem sequências percentuais introduzidas pela URL
### Requirement: Modelo de dados de jogo

O sistema SHALL persistir jogos com metadados de biblioteca, referencias de midia, `rom_path`, `launchbox_id`, status de colecao e `launch_count`.

#### Scenario: Criacao minima

- **WHEN** o usuario cria um jogo com titulo e plataforma
- **THEN** o registro e salvo com `favorite = false`, `play_status = "unplayed"` e `launch_count = 0`

#### Scenario: Titulo ausente

- **WHEN** o usuario tenta criar um jogo sem `title`
- **THEN** o sistema retorna erro de validacao

### Requirement: CRUD e consultas do desktop

O serviço desktop de jogos SHALL oferecer as operações `list`, `listGenres`, `get`, `create`, `update`, `delete`, `listMedia`, `listVersions`, `collectionCounts`, `launchStats`, `coverStats`, `syncCovers`, `resetLaunchStats` e `launch`.

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
