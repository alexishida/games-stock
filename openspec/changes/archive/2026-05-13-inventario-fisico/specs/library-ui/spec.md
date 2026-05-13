## MODIFIED Requirements

### Requirement: Painel lateral (Sidebar)
O sistema SHALL exibir painel lateral com branding, modo de navegação contextual e botões fixos de acesso às seções principais. O modo de navegação SHALL alternar entre `library` e `inventory` conforme a seção ativa.

No modo `library` (padrão), SHALL exibir árvore de plataformas agrupadas por categoria. Plataformas sem jogos não devem aparecer na árvore.

No modo `inventory`, SHALL substituir a árvore de plataformas por filtros do inventário: lista de plataformas com itens de hardware, lista de tipos de item e lista de estados de conservação. Cada filtro SHALL destacar a seleção ativa.

A parte inferior da sidebar SHALL exibir sempre dois botões de navegação principal: "Biblioteca" (ativa modo `library`) e "Inventário" (ativa modo `inventory`). O botão de "Configurar" SHALL permanecer fixo na sidebar em ambos os modos.

#### Scenario: Modo library — comportamento padrão
- **WHEN** o app é aberto ou o usuário clica em "Biblioteca"
- **THEN** a sidebar exibe a árvore de plataformas e o botão "Biblioteca" fica destacado

#### Scenario: Alternar para modo inventory
- **WHEN** o usuário clica em "Inventário" na sidebar
- **THEN** a sidebar substitui a árvore de plataformas pelos filtros de inventário (plataformas com itens, tipos, condições) e o botão "Inventário" fica destacado

#### Scenario: Selecionar plataforma no modo library
- **WHEN** o usuário clica em uma plataforma na árvore no modo library
- **THEN** a plataforma fica destacada e a grade de jogos filtra por essa plataforma

#### Scenario: Filtrar por plataforma no modo inventory
- **WHEN** o usuário clica em uma plataforma na lista de filtros do inventário
- **THEN** a plataforma fica destacada e a grade de inventário filtra por essa plataforma

#### Scenario: Plataforma sem jogos não aparece no modo library
- **WHEN** uma plataforma não tem jogos associados e o modo é library
- **THEN** ela não aparece na árvore lateral

#### Scenario: Plataforma sem itens não aparece no modo inventory
- **WHEN** uma plataforma não tem itens de hardware e o modo é inventory
- **THEN** ela não aparece na lista de filtros do inventário

#### Scenario: Abrir configurações pela Sidebar
- **WHEN** o usuário clica em "Configurar" no painel lateral (em qualquer modo)
- **THEN** o SettingsModal é aberto na seção "geral"

#### Scenario: Botão Biblioteca sempre visível no modo inventory
- **WHEN** o modo é inventory
- **THEN** o botão "Biblioteca" está visível na sidebar e ao clicar retorna para o modo library

#### Scenario: Botão Inventário sempre visível no modo library
- **WHEN** o modo é library
- **THEN** o botão "Inventário" está visível na sidebar e ao clicar alterna para o modo inventory
