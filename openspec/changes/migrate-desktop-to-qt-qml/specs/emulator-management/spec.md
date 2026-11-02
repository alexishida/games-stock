<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## RENAMED Requirements
- FROM: `### Requirement: CRUD de emuladores via IPC`
- TO: `### Requirement: CRUD de emuladores do desktop`

## MODIFIED Requirements

### Requirement: CRUD de emuladores do desktop

O sistema SHALL expor `list()`, `create()`, `update()` e `delete()` no serviço desktop de emuladores. O campo `executable` SHALL aceitar caminho absoluto, relativo ou nome resolvivel via `PATH`.

#### Scenario: Criar emulador com nome duplicado

- **WHEN** o usuario tenta salvar um nome ja existente
- **THEN** o sistema retorna erro de duplicidade

#### Scenario: Excluir RetroArch

- **WHEN** o usuario tenta remover um emulador com `is_retroarch = 1`
- **THEN** o sistema bloqueia a exclusao



