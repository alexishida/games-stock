# library-ui - Especificacao

## Purpose
Define a interface principal da biblioteca: barra superior, painel lateral, grade/lista de jogos com paginacao, busca, filtros, tema visual, modal de configuracoes e central de notificacoes de jobs em background.

## Requirements
### Requirement: Barra superior (TopBar)
O sistema SHALL exibir uma barra superior com campo de busca, controles de ordenacao, alternancia de visualizacao e contador de jogos. A barra SHALL ser ocultada quando um jogo estiver selecionado (modo detalhe).

#### Scenario: Contador atualiza com filtro
- **WHEN** o usuario seleciona uma plataforma no painel lateral
- **THEN** o contador atualiza para "X de Y jogos"

#### Scenario: Sem filtro ativo
- **WHEN** "Todos" esta selecionado
- **THEN** o contador exibe o total de jogos sem distincao de filtrado vs. total

#### Scenario: Ordenacao pela barra superior
- **WHEN** o usuario clica no botao de ordenacao
- **THEN** a ordenacao cicla entre "A-Z", "Ano" e "Recentes" e a biblioteca e recarregada

#### Scenario: Alternancia de visualizacao
- **WHEN** o usuario clica nos botoes de grid ou lista
- **THEN** a area principal alterna entre visualizacao em grade e visualizacao em lista

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

### Requirement: Grade de box arts (GameGrid)
O sistema SHALL exibir jogos em grade com box art ou placeholder, plataforma e titulo. A grade SHALL usar paginacao de 50 itens por pagina.

#### Scenario: Card com box art
- **WHEN** um jogo tem `box_art_path` valido
- **THEN** a imagem e exibida como capa do card com proporcao preservada

#### Scenario: Card sem box art
- **WHEN** um jogo nao tem `box_art_path`
- **THEN** exibe placeholder com nome da plataforma

#### Scenario: Selecao de card
- **WHEN** o usuario clica em um card
- **THEN** a TopBar e ocultada e o painel GameDetail ocupa a area principal

#### Scenario: Paginacao da grade
- **WHEN** o conjunto filtrado tem mais de 50 jogos
- **THEN** a Pagination exibe "inicio-fim de total" e botoes de navegacao de pagina

### Requirement: Visualizacao em lista (GameList)
O sistema SHALL oferecer visualizacao em lista como alternativa a grade, exibindo thumbnail, titulo, plataforma, publisher e ano.

#### Scenario: Alternar para lista
- **WHEN** o usuario seleciona visualizacao em lista
- **THEN** a area principal exibe jogos em linhas de tabela com colunas: thumbnail, titulo, plataforma, publisher, ano

#### Scenario: Paginacao da lista
- **WHEN** o conjunto filtrado tem mais de 50 itens
- **THEN** a Pagination funciona igual a grade

### Requirement: Campo de busca
O sistema SHALL filtrar jogos em tempo real conforme o usuario digita, comparando contra titulo de forma case-insensitive e combinando com filtros ativos.

#### Scenario: Busca com filtro de plataforma
- **WHEN** "Sega Genesis" esta selecionado e o usuario digita "batman"
- **THEN** a grade exibe apenas jogos da plataforma com "batman" no titulo

#### Scenario: Limpar busca
- **WHEN** o campo de busca e esvaziado
- **THEN** a grade restaura jogos dos filtros ativos e a pagina e resetada para 1

### Requirement: Tema escuro
O sistema SHALL usar tema escuro com variaveis CSS para background, sidebar, card hover, accent, texto primario e texto secundario.

#### Scenario: Consistencia visual
- **WHEN** o app e aberto
- **THEN** todos os componentes seguem o tema escuro definido sem flash de tema claro

### Requirement: Filtros de colecao
O sistema SHALL oferecer filtros para "all", "favorites", "completed" e "unplayed". Cada filtro SHALL ser combinado com busca, plataforma e paginacao.

#### Scenario: Ativar favoritos
- **WHEN** o usuario ativa o filtro de favoritos
- **THEN** a biblioteca exibe apenas jogos com `favorite = true`

#### Scenario: Ativar concluidos
- **WHEN** o usuario ativa o filtro de concluidos
- **THEN** a biblioteca exibe apenas jogos com `play_status = "completed"`

#### Scenario: Ativar nao jogados
- **WHEN** o usuario ativa o filtro de nao jogados
- **THEN** a biblioteca exibe apenas jogos com `play_status = "unplayed"`

### Requirement: SettingsModal
O sistema SHALL fornecer um modal de configuracoes com navegacao entre as secoes "geral", "biblioteca", "plataformas", "emuladores", "covers" e "sobre". O modal SHALL ser acessivel pelo botao do painel lateral e pelos canais IPC `library:openPlatformManager` e `romFolderImport:openImporter`. A secao "geral" SHALL incluir controles de portabilidade para exportar e importar dados do GameStock.

#### Scenario: Abrir na secao biblioteca
- **WHEN** o canal `romFolderImport:openImporter` e recebido ou o usuario clica em "Gerenciar biblioteca"
- **THEN** o SettingsModal abre na secao "biblioteca" exibindo o RomFolderImporter

#### Scenario: Configurar importacao com subpastas
- **WHEN** o usuario abre o RomFolderImporter e adiciona uma nova pasta
- **THEN** a UI oferece uma opcao explicita para incluir ou nao ROMs de subpastas antes de rodar o scan

#### Scenario: Abrir na secao plataformas
- **WHEN** o canal `library:openPlatformManager` e recebido
- **THEN** o SettingsModal abre na secao "plataformas" exibindo o PlatformManager

#### Scenario: Navegar entre secoes
- **WHEN** o modal esta aberto e o usuario clica em outra secao na barra lateral do modal
- **THEN** o conteudo principal alterna para a secao selecionada

#### Scenario: Exibir portabilidade em Geral
- **WHEN** o usuario abre a secao "geral"
- **THEN** o SettingsModal exibe area de exportacao/importacao com opcoes para imagens, metadados, plataformas e localizacoes de ROMs

#### Scenario: Selecionar categorias para exportacao
- **WHEN** o usuario marca categorias de exportacao na secao "geral"
- **THEN** a acao de exportar usa somente as categorias selecionadas ao chamar `window.gameStockAPI.dataPortability.exportPackage`

#### Scenario: Previsualizar importacao
- **WHEN** o usuario seleciona um pacote para importar
- **THEN** a UI chama `window.gameStockAPI.dataPortability.previewImport` e mostra categorias disponiveis, contagens e avisos antes de confirmar

#### Scenario: Confirmar importacao seletiva
- **WHEN** o usuario confirma importacao com categorias selecionadas
- **THEN** a UI chama `window.gameStockAPI.dataPortability.importPackage`, mostra resumo final e atualiza a biblioteca visivel

### Requirement: Central de notificacoes (NotificationCenter)
O sistema SHALL exibir um painel flutuante com cards de progresso e resumo para cada job de importacao de pasta de ROMs em background.

#### Scenario: Progresso em background
- **WHEN** um job de importacao esta em andamento
- **THEN** o NotificationCenter exibe um card com barra de progresso, arquivo atual, stage e mensagem

#### Scenario: Resumo ao concluir
- **WHEN** um job conclui
- **THEN** o card exibe o resumo: criados, atualizados, sem match e downloads com falha

#### Scenario: Descartar notificacao
- **WHEN** o usuario clica em X em um card concluido ou com falha
- **THEN** o card e removido do NotificationCenter

#### Scenario: Sem jobs ativos
- **WHEN** nao ha jobs em andamento ou concluidos nao descartados
- **THEN** o NotificationCenter nao e renderizado
