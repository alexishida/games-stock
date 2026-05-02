# physical-inventory - Especificação

## Purpose
Define o controle de inventário físico para jogos possuídos em cartucho, disco ou mídia equivalente.

## Requirements
### Requirement: Flag de posse física por jogo
O sistema SHALL permitir marcar cada jogo como possuído fisicamente via campo `owned_physical` (booleano, default false). O campo SHALL ser editável no GameForm dentro do GameDetail.

#### Scenario: Marcar jogo como possuído fisicamente
- **WHEN** o usuário ativa "Tenho físico" no GameForm e salva
- **THEN** `owned_physical` é atualizado para true e persiste entre sessões

#### Scenario: Jogo sem cópia física
- **WHEN** `owned_physical = false`
- **THEN** nenhum indicador de inventário físico é exibido para o jogo

### Requirement: Condição do item físico
O sistema SHALL permitir registrar `physical_condition` com valores "Mint", "Near Mint", "Good", "Fair" e "Poor". O campo SHALL aparecer apenas quando `owned_physical = true`.

#### Scenario: Registrar condição
- **WHEN** o usuário seleciona condição "Good" para um jogo físico e salva
- **THEN** `physical_condition = "Good"` é salvo no banco

#### Scenario: Condição sem posse física
- **WHEN** `owned_physical = false`
- **THEN** o campo `physical_condition` não é exibido na UI

### Requirement: Filtro por inventário físico
O sistema SHALL permitir filtrar a biblioteca para exibir apenas jogos físicos via parâmetro de filtro na listagem.

#### Scenario: Ativar filtro de inventário
- **WHEN** o filtro de inventário físico está ativo
- **THEN** a grade exibe somente jogos com `owned_physical = true`
