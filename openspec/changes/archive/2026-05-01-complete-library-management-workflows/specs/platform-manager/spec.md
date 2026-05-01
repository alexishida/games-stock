## ADDED Requirements

### Requirement: UI de gerenciamento de plataformas
O sistema SHALL fornecer uma interface de gerenciamento de plataformas acessível pelo menu ou por controle visível da biblioteca. A interface SHALL listar plataformas com categoria e contagem de jogos, permitir criar, editar e excluir plataformas, e SHALL usar as validações existentes do IPC.

#### Scenario: Criar plataforma pela UI
- **WHEN** o usuário informa nome e categoria válidos e salva uma nova plataforma
- **THEN** a plataforma é criada, aparece na árvore lateral e fica disponível para criação manual de jogos

#### Scenario: Editar plataforma pela UI
- **WHEN** o usuário altera o nome ou categoria de uma plataforma existente e salva
- **THEN** a plataforma é atualizada na árvore lateral e nos jogos associados

#### Scenario: Excluir plataforma sem jogos
- **WHEN** o usuário exclui uma plataforma sem jogos associados e confirma
- **THEN** a plataforma é removida e deixa de aparecer na árvore lateral

#### Scenario: Excluir plataforma com jogos
- **WHEN** o usuário tenta excluir uma plataforma que possui jogos associados
- **THEN** o sistema exibe a mensagem "Não é possível remover plataforma com jogos associados" e mantém a plataforma
