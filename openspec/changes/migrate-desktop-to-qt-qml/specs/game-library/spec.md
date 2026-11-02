<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## RENAMED Requirements
- FROM: `### Requirement: CRUD e consultas via IPC`
- TO: `### Requirement: CRUD e consultas do desktop`

## MODIFIED Requirements

### Requirement: CRUD e consultas do desktop

O serviço desktop de jogos SHALL oferecer as operações `list`, `listGenres`, `get`, `create`, `update`, `delete`, `listMedia`, `listVersions`, `collectionCounts`, `launchStats`, `coverStats`, `syncCovers`, `resetLaunchStats` e `launch`.

#### Scenario: Listar por filtros

- **WHEN** `games.list()` recebe filtros de plataforma, busca, genero, colecao, ordenacao e pagina
- **THEN** a API retorna somente os jogos que atendem aos criterios

#### Scenario: Listar generos

- **WHEN** `games.listGenres()` e chamado
- **THEN** a API retorna os generos distintos usados pela biblioteca atual



