## MODIFIED Requirements

### Requirement: Remover associação de ROM
O sistema SHALL permitir remover a associação de ROM de um jogo, definindo `rom_path` como null. A remoção SHALL ser persistida imediatamente quando o usuário aciona "Remover ROM".

#### Scenario: Remover ROM
- **WHEN** o usuário clica em "Remover ROM" no detalhe de um jogo com ROM associada
- **THEN** `rom_path` é definido como null no banco, a biblioteca é atualizada e o ícone de ROM desaparece do card

#### Scenario: Cancelar remoção de ROM
- **WHEN** o usuário inicia a remoção mas cancela a confirmação
- **THEN** `rom_path` permanece inalterado
