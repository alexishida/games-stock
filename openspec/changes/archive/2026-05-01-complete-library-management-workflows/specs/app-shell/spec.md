## MODIFIED Requirements

### Requirement: Menu nativo da aplicação
O sistema SHALL exibir uma barra de menu nativa com itens: MENU (importar jogos, gerenciar plataformas, configurações, sair), FERRAMENTAS, VISUALIZAÇÃO (grade/lista), ORGANIZADO POR, GRUPO DE IMAGENS, EMBLEMAS. Itens disponíveis no MVP SHALL enviar eventos ao renderer para abrir diálogos ou atualizar o estado da biblioteca.

#### Scenario: Menu sair
- **WHEN** o usuário clica em MENU -> Sair
- **THEN** o aplicativo fecha graciosamente

#### Scenario: Menu visualização
- **WHEN** o usuário clica em VISUALIZAÇÃO -> Grade ou Lista
- **THEN** a área principal alterna entre grade de box arts e visualização em lista

#### Scenario: Menu importar jogos
- **WHEN** o usuário clica em MENU -> Importar Jogos ou FERRAMENTAS -> Importar do LaunchBox
- **THEN** o modal de importação LaunchBox é aberto

#### Scenario: Menu gerenciar plataformas
- **WHEN** o usuário clica em MENU -> Gerenciar Plataformas
- **THEN** a interface de gerenciamento de plataformas é aberta

#### Scenario: Menu organizar por
- **WHEN** o usuário clica em ORGANIZADO POR -> Título, Ano ou Recentes
- **THEN** a biblioteca aplica a ordenação selecionada
