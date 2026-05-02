# library-ui - Especificação

## Purpose
Define a interface principal da biblioteca: barra superior, painel lateral, grade/lista de jogos com paginação, busca, filtros, tema visual, modal de configurações e central de notificações de jobs em background.

## Requirements
### Requirement: Barra superior (TopBar)
O sistema SHALL exibir uma barra superior com campo de busca, controles de ordenação, alternância de visualização e contador de jogos. A barra SHALL ser ocultada quando um jogo estiver selecionado (modo detalhe).

#### Scenario: Contador atualiza com filtro
- **WHEN** o usuário seleciona uma plataforma no painel lateral
- **THEN** o contador atualiza para "X de Y jogos"

#### Scenario: Sem filtro ativo
- **WHEN** "Todos" está selecionado
- **THEN** o contador exibe o total de jogos sem distinção de filtrado vs. total

#### Scenario: Ordenação pela barra superior
- **WHEN** o usuário clica no botão de ordenação
- **THEN** a ordenação cicla entre "A-Z", "Ano" e "Recentes" e a biblioteca é recarregada

#### Scenario: Alternância de visualização
- **WHEN** o usuário clica nos botões de grid ou lista
- **THEN** a área principal alterna entre visualização em grade e visualização em lista

### Requirement: Painel lateral (Sidebar)
O sistema SHALL exibir painel lateral com branding, árvore de plataformas agrupadas por categoria e botão de acesso às configurações. Plataformas sem jogos não devem aparecer na árvore.

#### Scenario: Selecionar plataforma
- **WHEN** o usuário clica em uma plataforma na árvore
- **THEN** a plataforma fica destacada e a grade filtra jogos dessa plataforma

#### Scenario: Selecionar Todos
- **WHEN** o usuário clica em "Todos"
- **THEN** a seleção de plataforma é removida e todos os jogos do banco são exibidos

#### Scenario: Plataforma sem jogos
- **WHEN** uma plataforma não tem jogos associados
- **THEN** ela não aparece na árvore lateral

#### Scenario: Abrir configurações pela Sidebar
- **WHEN** o usuário clica em "Gerenciar biblioteca" no painel lateral
- **THEN** o SettingsModal é aberto na seção "biblioteca"

### Requirement: Grade de box arts (GameGrid)
O sistema SHALL exibir jogos em grade com box art ou placeholder, plataforma e título. A grade SHALL usar paginação de 50 itens por página.

#### Scenario: Card com box art
- **WHEN** um jogo tem `box_art_path` válido
- **THEN** a imagem é exibida como capa do card com proporção preservada

#### Scenario: Card sem box art
- **WHEN** um jogo não tem `box_art_path`
- **THEN** exibe placeholder com nome da plataforma

#### Scenario: Seleção de card
- **WHEN** o usuário clica em um card
- **THEN** a TopBar é ocultada e o painel GameDetail ocupa a área principal

#### Scenario: Paginação da grade
- **WHEN** o conjunto filtrado tem mais de 50 jogos
- **THEN** a Pagination exibe "início–fim de total" e botões de navegação de página

### Requirement: Visualização em lista (GameList)
O sistema SHALL oferecer visualização em lista como alternativa à grade, exibindo thumbnail, título, plataforma, publisher e ano.

#### Scenario: Alternar para lista
- **WHEN** o usuário seleciona visualização em lista
- **THEN** a área principal exibe jogos em linhas de tabela com colunas: thumbnail, título, plataforma, publisher, ano

#### Scenario: Paginação da lista
- **WHEN** o conjunto filtrado tem mais de 50 itens
- **THEN** a Pagination funciona igual à grade

### Requirement: Campo de busca
O sistema SHALL filtrar jogos em tempo real conforme o usuário digita, comparando contra título de forma case-insensitive e combinando com filtros ativos.

#### Scenario: Busca com filtro de plataforma
- **WHEN** "Sega Genesis" está selecionado e o usuário digita "batman"
- **THEN** a grade exibe apenas jogos da plataforma com "batman" no título

#### Scenario: Limpar busca
- **WHEN** o campo de busca é esvaziado
- **THEN** a grade restaura jogos dos filtros ativos e a página é resetada para 1

### Requirement: Tema escuro
O sistema SHALL usar tema escuro com variáveis CSS para background, sidebar, card hover, accent, texto primário e texto secundário.

#### Scenario: Consistência visual
- **WHEN** o app é aberto
- **THEN** todos os componentes seguem o tema escuro definido sem flash de tema claro

### Requirement: Filtros de coleção
O sistema SHALL oferecer filtros para "all", "favorites", "completed" e "unplayed". Cada filtro SHALL ser combinado com busca, plataforma e paginação.

#### Scenario: Ativar favoritos
- **WHEN** o usuário ativa o filtro de favoritos
- **THEN** a biblioteca exibe apenas jogos com `favorite = true`

#### Scenario: Ativar concluídos
- **WHEN** o usuário ativa o filtro de concluídos
- **THEN** a biblioteca exibe apenas jogos com `play_status = "completed"`

#### Scenario: Ativar não jogados
- **WHEN** o usuário ativa o filtro de não jogados
- **THEN** a biblioteca exibe apenas jogos com `play_status = "unplayed"`

### Requirement: SettingsModal
O sistema SHALL fornecer um modal de configurações com navegação entre as seções "biblioteca" (RomFolderImporter) e "plataformas" (PlatformManager). O modal SHALL ser acessível pelo botão do painel lateral e pelos canais IPC `library:openPlatformManager` e `romFolderImport:openImporter`.

#### Scenario: Abrir na seção biblioteca
- **WHEN** o canal `romFolderImport:openImporter` é recebido ou o usuário clica em "Gerenciar biblioteca"
- **THEN** o SettingsModal abre na seção "biblioteca" exibindo o RomFolderImporter

#### Scenario: Abrir na seção plataformas
- **WHEN** o canal `library:openPlatformManager` é recebido
- **THEN** o SettingsModal abre na seção "plataformas" exibindo o PlatformManager

#### Scenario: Navegar entre seções
- **WHEN** o modal está aberto e o usuário clica em outra seção na barra lateral do modal
- **THEN** o conteúdo principal alterna para a seção selecionada

### Requirement: Central de notificações (NotificationCenter)
O sistema SHALL exibir um painel flutuante com cards de progresso e resumo para cada job de importação de pasta de ROMs em background.

#### Scenario: Progresso em background
- **WHEN** um job de importação está em andamento
- **THEN** o NotificationCenter exibe um card com barra de progresso, arquivo atual, stage e mensagem

#### Scenario: Resumo ao concluir
- **WHEN** um job conclui
- **THEN** o card exibe o resumo: criados, atualizados, sem match e downloads com falha

#### Scenario: Descartar notificação
- **WHEN** o usuário clica em X em um card concluído ou com falha
- **THEN** o card é removido do NotificationCenter

#### Scenario: Sem jobs ativos
- **WHEN** não há jobs em andamento ou concluídos não descartados
- **THEN** o NotificationCenter não é renderizado
