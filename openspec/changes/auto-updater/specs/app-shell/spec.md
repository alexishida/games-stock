## MODIFIED Requirements

### Requirement: Janela principal Electron

O sistema SHALL criar uma janela Electron principal com dimensões mínimas de 1024x768px, título "GameStock", ícone personalizado e frame nativo. A janela SHALL persistir posição e tamanho entre sessões. A janela principal SHALL ser criada somente após o fluxo de splash/update concluir (com ou sem update aplicado).

#### Scenario: Abertura do app

- **WHEN** o usuário abre o GameStock
- **THEN** a splash screen abre primeiro; quando o fluxo de verificação conclui, a splash fecha e a janela principal abre com as últimas dimensões/posição salvas ou 1280x800 na primeira execução

#### Scenario: Fechamento e reabertura

- **WHEN** o usuário fecha e reabre o app
- **THEN** a janela restaura a posição e o tamanho anteriores
