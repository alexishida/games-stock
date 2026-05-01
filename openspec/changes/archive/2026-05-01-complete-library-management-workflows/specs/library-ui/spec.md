## MODIFIED Requirements

### Requirement: Barra de menu superior
O sistema SHALL exibir uma barra de menu horizontal no topo da janela com controles de busca, visualização, ordenação, filtro físico e contador. À direita SHALL exibir o contador "Exibindo X de Y total de jogos". Os controles de ordenação e filtros SHALL atualizar a biblioteca em tempo real.

#### Scenario: Contador atualiza com filtro
- **WHEN** o usuário seleciona uma plataforma no painel lateral
- **THEN** o contador atualiza para "Exibindo [filtrados] de [total] total de jogos"

#### Scenario: Sem filtro ativo
- **WHEN** "Todos" está selecionado
- **THEN** o contador exibe "Exibindo [total] de [total] total de jogos"

#### Scenario: Ordenação pela barra superior
- **WHEN** o usuário seleciona ordenação por ano ou recentes
- **THEN** a grade ou lista é recarregada com a ordenação selecionada

### Requirement: Campo de busca
O sistema SHALL filtrar jogos em tempo real conforme o usuário digita no campo de busca, comparando contra o título (case-insensitive). A busca SHALL ser combinável com o filtro de plataforma ativo, filtro físico e filtro de coleção ativo.

#### Scenario: Busca com filtro de plataforma
- **WHEN** "Sega Genesis" está selecionado e o usuário digita "batman"
- **THEN** a grade exibe apenas jogos da Sega Genesis com "batman" no título

#### Scenario: Busca com favoritos
- **WHEN** "Favoritos" está selecionado e o usuário digita "sonic"
- **THEN** a grade exibe apenas jogos favoritos cujo título contém "sonic"

#### Scenario: Limpar busca
- **WHEN** o campo de busca é esvaziado
- **THEN** a grade restaura todos os jogos do filtro de plataforma e coleção ativos

## ADDED Requirements

### Requirement: Filtros de coleção
O sistema SHALL oferecer filtros de coleção para "Todos os jogos", "Favoritos", "Concluídos" e "Não jogados". Cada filtro SHALL ser persistido no estado da biblioteca e combinado com busca, plataforma e inventário físico.

#### Scenario: Ativar favoritos
- **WHEN** o usuário clica em "Favoritos"
- **THEN** a biblioteca exibe apenas jogos marcados como favoritos

#### Scenario: Ativar concluídos
- **WHEN** o usuário clica em "Concluídos"
- **THEN** a biblioteca exibe apenas jogos com `play_status = "completed"`

#### Scenario: Ativar não jogados
- **WHEN** o usuário clica em "Não jogados"
- **THEN** a biblioteca exibe apenas jogos com `play_status = "unplayed"`
