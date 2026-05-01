# library-ui - Especificação

## Purpose
Define a interface principal da biblioteca: barra superior, painel lateral, grade/lista de jogos, busca, filtros e tema visual.

## Requirements
### Requirement: Barra de menu superior
O sistema SHALL exibir uma barra superior com busca, visualização, ordenação, filtro físico e contador. Os controles SHALL atualizar a biblioteca em tempo real.

#### Scenario: Contador atualiza com filtro
- **WHEN** o usuário seleciona uma plataforma no painel lateral
- **THEN** o contador atualiza para "Exibindo [filtrados] de [total] total de jogos"

#### Scenario: Sem filtro ativo
- **WHEN** "Todos" está selecionado
- **THEN** o contador exibe "Exibindo [total] de [total] total de jogos"

#### Scenario: Ordenação pela barra superior
- **WHEN** o usuário seleciona ordenação por ano ou recentes
- **THEN** a grade ou lista é recarregada com a ordenação selecionada

### Requirement: Painel lateral de plataformas
O sistema SHALL exibir painel lateral com busca, dropdown de categoria e árvore expansível por categoria contendo plataformas filhas. O item selecionado SHALL ter destaque visual.

#### Scenario: Expandir categoria
- **WHEN** o usuário clica em uma categoria
- **THEN** as plataformas filhas são exibidas com indentação

#### Scenario: Selecionar plataforma
- **WHEN** o usuário clica em "Sega Genesis"
- **THEN** a plataforma fica destacada e a grade filtra jogos dessa plataforma

#### Scenario: Filtrar por categoria no dropdown
- **WHEN** o usuário seleciona "Portáteis"
- **THEN** a árvore exibe apenas plataformas dessa categoria

### Requirement: Grade de box arts
O sistema SHALL exibir jogos em grade com box art ou placeholder, título truncado, publisher e destaque de seleção. A grade SHALL suportar scroll virtual para grandes coleções.

#### Scenario: Card com box art
- **WHEN** um jogo tem `box_art_path` válido
- **THEN** a imagem é exibida como capa do card com proporção preservada

#### Scenario: Card sem box art
- **WHEN** um jogo não tem `box_art_path`
- **THEN** exibe placeholder com ícone e nome da plataforma

#### Scenario: Seleção de card
- **WHEN** o usuário clica em um card
- **THEN** o card recebe destaque e o painel de detalhes pode ser aberto

#### Scenario: Grade com 500+ jogos
- **WHEN** a grade renderiza mais de 500 jogos
- **THEN** apenas cards visíveis na viewport são renderizados

### Requirement: Visualização em lista
O sistema SHALL oferecer visualização em lista como alternativa à grade, exibindo capa pequena, título, plataforma, publisher, ano e badge físico.

#### Scenario: Alternar para lista
- **WHEN** o usuário clica em VISUALIZAÇÃO -> Lista
- **THEN** a área principal exibe jogos em linhas de tabela

### Requirement: Campo de busca
O sistema SHALL filtrar jogos em tempo real conforme o usuário digita, comparando contra título de forma case-insensitive e combinando com filtros ativos.

#### Scenario: Busca com filtro de plataforma
- **WHEN** "Sega Genesis" está selecionado e o usuário digita "batman"
- **THEN** a grade exibe apenas jogos da plataforma com "batman" no título

#### Scenario: Busca com favoritos
- **WHEN** "Favoritos" está selecionado e o usuário digita "sonic"
- **THEN** a grade exibe apenas favoritos cujo título contém "sonic"

#### Scenario: Limpar busca
- **WHEN** o campo de busca é esvaziado
- **THEN** a grade restaura jogos dos filtros ativos

### Requirement: Tema escuro
O sistema SHALL usar tema escuro com cores definidas para background, sidebar, card hover, accent, texto primário e texto secundário.

#### Scenario: Consistência visual
- **WHEN** o app é aberto
- **THEN** todos os componentes seguem o tema escuro definido sem flash de tema claro

### Requirement: Filtros de coleção
O sistema SHALL oferecer filtros para todos os jogos, favoritos, concluídos e não jogados. Cada filtro SHALL ser persistido no estado da biblioteca e combinado com busca, plataforma e inventário físico.

#### Scenario: Ativar favoritos
- **WHEN** o usuário clica em "Favoritos"
- **THEN** a biblioteca exibe apenas jogos marcados como favoritos

#### Scenario: Ativar concluídos
- **WHEN** o usuário clica em "Concluídos"
- **THEN** a biblioteca exibe apenas jogos com `play_status = "completed"`

#### Scenario: Ativar não jogados
- **WHEN** o usuário clica em "Não jogados"
- **THEN** a biblioteca exibe apenas jogos com `play_status = "unplayed"`
