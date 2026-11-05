<!-- Delta sincronizado com o estado nativo consolidado; não implica arquivamento. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: CRUD de emuladores do desktop

O sistema SHALL expor `list()`, `create()`, `update()` e `delete()` no serviço desktop de emuladores. O campo `executable` SHALL aceitar caminho absoluto, relativo ou nome resolvivel via `PATH`.

#### Scenario: Criar emulador com nome duplicado

- **WHEN** o usuario tenta salvar um nome ja existente
- **THEN** o sistema retorna erro de duplicidade

#### Scenario: Excluir RetroArch

- **WHEN** o usuario tenta remover um emulador com `is_retroarch = 1`
- **THEN** o sistema bloqueia a exclusao
