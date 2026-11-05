<!-- Delta sincronizado com o estado nativo consolidado; não implica arquivamento. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: CRUD do desktop

O serviço desktop de plataformas SHALL oferecer as operações `list`, `create`, `update`, `delete`, `getMappings` e `saveMappings`.

#### Scenario: Listagem com contagem

- **WHEN** `platforms.list()` e chamado
- **THEN** a resposta inclui `gameCount` por plataforma

#### Scenario: Remocao bloqueada por regra de negocio

- **WHEN** o usuario tenta excluir plataforma default ou com jogos associados
- **THEN** o sistema bloqueia a remocao
