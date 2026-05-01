## ADDED Requirements

### Requirement: Barra de menu superior
O sistema SHALL exibir uma barra de menu horizontal no topo da janela com os itens: MENU, FERRAMENTAS, VISUALIZAÇÃO, ORGANIZADO POR, GRUPO DE IMAGENS, EMBLEMAS. À direita SHALL exibir o contador "Exibindo X de Y total de jogos".

#### Scenario: Contador atualiza com filtro
- **WHEN** o usuário seleciona uma plataforma no painel lateral
- **THEN** o contador atualiza para "Exibindo [filtrados] de [total] total de jogos"

#### Scenario: Sem filtro ativo
- **WHEN** "Todos" está selecionado
- **THEN** o contador exibe "Exibindo [total] de [total] total de jogos"

### Requirement: Painel lateral de plataformas
O sistema SHALL exibir um painel lateral esquerdo (~220px) com: campo de busca textual com ícone de filtro, dropdown "Categoria da Plataforma" para filtrar categorias, e árvore de navegação com nós expansíveis por categoria contendo as plataformas filhas. O item selecionado SHALL ter destaque em azul (`#2563eb`).

#### Scenario: Expandir categoria
- **WHEN** o usuário clica em uma categoria (ex: "Consoles")
- **THEN** as plataformas filhas são exibidas com indentação

#### Scenario: Selecionar plataforma
- **WHEN** o usuário clica em "Sega Genesis" na árvore
- **THEN** "Sega Genesis" fica destacado em azul e a grade filtra os jogos dessa plataforma

#### Scenario: Filtrar por categoria no dropdown
- **WHEN** o usuário seleciona "Portáteis" no dropdown
- **THEN** a árvore exibe apenas plataformas da categoria "Portáteis"

### Requirement: Grade de box arts (visualização padrão)
O sistema SHALL exibir jogos em grade com colunas de ~150px de largura. Cada card SHALL mostrar: imagem da box art (ou placeholder se ausente), título truncado com ellipsis, publisher em cor secundária. O card selecionado SHALL ter borda de destaque. A grade SHALL suportar scroll virtual para grandes coleções.

#### Scenario: Card com box art
- **WHEN** um jogo tem `box_art_path` válido
- **THEN** a imagem é exibida como capa do card com proporção preservada

#### Scenario: Card sem box art
- **WHEN** um jogo não tem `box_art_path`
- **THEN** exibe placeholder com ícone de controle/gamepad e o nome da plataforma

#### Scenario: Seleção de card
- **WHEN** o usuário clica em um card
- **THEN** o card recebe borda de destaque e o painel de detalhes pode ser aberto

#### Scenario: Grade com 500+ jogos
- **WHEN** a grade renderiza mais de 500 jogos
- **THEN** apenas os cards visíveis na viewport são renderizados (virtualização)

### Requirement: Visualização em lista
O sistema SHALL oferecer visualização em lista como alternativa à grade, exibindo: box art thumbnail pequena, título, plataforma, publisher, ano, e badge de inventário físico em colunas.

#### Scenario: Alternar para lista
- **WHEN** o usuário clica em VISUALIZAÇÃO → Lista
- **THEN** a área principal exibe os jogos em linhas de tabela em vez de grade de cards

### Requirement: Campo de busca
O sistema SHALL filtrar jogos em tempo real conforme o usuário digita no campo de busca, comparando contra o título (case-insensitive). A busca SHALL ser combinável com o filtro de plataforma ativo.

#### Scenario: Busca com filtro de plataforma
- **WHEN** "Sega Genesis" está selecionado e o usuário digita "batman"
- **THEN** a grade exibe apenas jogos da Sega Genesis com "batman" no título

#### Scenario: Limpar busca
- **WHEN** o campo de busca é esvaziado
- **THEN** a grade restaura todos os jogos do filtro de plataforma ativo

### Requirement: Tema escuro
O sistema SHALL usar tema escuro com as cores: background `#1a1a2e`, sidebar `#16213e`, card hover `#0f3460`, accent/selecionado `#2563eb`, texto primário `#e2e8f0`, texto secundário `#94a3b8`. Sem opção de tema claro no MVP.

#### Scenario: Consistência visual
- **WHEN** o app é aberto
- **THEN** todos os componentes seguem o tema escuro definido sem flash de tema claro
