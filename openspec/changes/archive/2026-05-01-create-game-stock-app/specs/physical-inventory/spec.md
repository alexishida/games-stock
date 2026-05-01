## ADDED Requirements

### Requirement: Flag de posse física por jogo
O sistema SHALL permitir marcar cada jogo como possuído fisicamente via campo `owned_physical` (boolean). Jogos com `owned_physical = true` SHALL exibir um indicador visual distinto na grade (ex: badge/ícone de cartucho).

#### Scenario: Marcar jogo como possuído fisicamente
- **WHEN** o usuário ativa "Tenho físico" no detalhe de um jogo
- **THEN** `owned_physical` é atualizado para true e o badge aparece na capa na grade

#### Scenario: Jogo sem cópia física
- **WHEN** `owned_physical = false` (padrão)
- **THEN** nenhum badge de inventário físico é exibido no card

### Requirement: Condição do item físico
O sistema SHALL permitir registrar a condição do item físico via campo `physical_condition` com valores: "Mint", "Near Mint", "Good", "Fair", "Poor". Este campo SHALL ser visível/editável apenas quando `owned_physical = true`.

#### Scenario: Registrar condição
- **WHEN** o usuário seleciona condição "Good" para um jogo com `owned_physical = true`
- **THEN** `physical_condition = "Good"` é salvo no banco

#### Scenario: Condição sem posse física
- **WHEN** `owned_physical = false`
- **THEN** o campo `physical_condition` não é exibido na UI

### Requirement: Filtro por inventário físico
O sistema SHALL permitir filtrar a biblioteca para exibir apenas jogos com `owned_physical = true`.

#### Scenario: Ativar filtro de inventário
- **WHEN** o usuário ativa o filtro "Apenas físicos"
- **THEN** a grade exibe somente jogos onde `owned_physical = true`
