# library-ui Specification

## Purpose
Definir a interface principal da biblioteca e do inventario, incluindo barra superior, sidebar, cabecalho de filtros, grade/lista, configuracoes e notificacoes de jobs.

## Requirements
### Requirement: TopBar da biblioteca

No modo `library`, o sistema SHALL exibir uma TopBar com busca, alternancia de visualizacao, ordenacao rapida e contador `Exibindo X de Y jogos`.

#### Scenario: Ordenacao rapida

- **WHEN** o usuario clica no icone de ordenar da TopBar
- **THEN** a ordenacao cicla entre `title`, `year` e `recent`

#### Scenario: TopBar oculta no detalhe

- **WHEN** um jogo esta selecionado ou o app esta no modo inventario
- **THEN** a TopBar da biblioteca nao e exibida

### Requirement: Header principal da biblioteca

Quando nenhum jogo esta selecionado, a area principal SHALL exibir abas de colecao, seletor de categoria por genero e seletor de ordenacao completa.

#### Scenario: Abas de colecao disponiveis

- **WHEN** a biblioteca principal esta aberta
- **THEN** o usuario ve as abas `Todos os jogos`, `Mais Jogados`, `Favoritos`, `Jogando` e `Concluido`

#### Scenario: Ordenacao completa

- **WHEN** o usuario usa o seletor `Ordenar por`
- **THEN** a UI permite escolher `A-Z`, `Ano`, `Recentes` e `Mais jogados`

### Requirement: Sidebar com dois modos

A sidebar SHALL alternar entre `library` e `inventory`, mantendo branding no topo, botoes `Biblioteca` e `Inventario` e o botao `Configuracoes`.

#### Scenario: Modo library

- **WHEN** o usuario esta na biblioteca
- **THEN** a sidebar mostra filtros de colecao e a arvore de plataformas agrupadas por categoria

#### Scenario: Modo inventory

- **WHEN** o usuario entra no inventario
- **THEN** a sidebar substitui a arvore por filtros de `Tipo` e `Condicao`, e exibe o botao `Novo item`

#### Scenario: Abrir configuracoes pela sidebar

- **WHEN** o usuario clica em `Configuracoes`
- **THEN** o SettingsModal abre na secao `biblioteca`

### Requirement: Visualizacoes da biblioteca

A biblioteca SHALL oferecer grade e lista, ambas paginadas.

#### Scenario: Grade de jogos

- **WHEN** o modo atual e `grid`
- **THEN** os cards exibem capa ou placeholder, plataforma, titulo e acoes rapidas

#### Scenario: Lista de jogos

- **WHEN** o modo atual e `list`
- **THEN** as linhas exibem thumbnail, titulo, plataforma, genero, publisher, ano, status e acao de launch

### Requirement: Busca e filtros combinados

A busca SHALL filtrar por titulo e combinar com plataforma, genero, colecao, ordenacao e paginacao.

#### Scenario: Reset de pagina ao mudar filtros

- **WHEN** o usuario altera busca, colecao, plataforma, genero ou ordenacao
- **THEN** a listagem volta para a primeira pagina do conjunto filtrado

### Requirement: SettingsModal

O modal de configuracoes SHALL navegar entre as secoes `plataformas`, `emuladores`, `biblioteca`, `covers`, `partidas`, `backup` e `sobre`.

#### Scenario: Abrir importador de pastas

- **WHEN** o canal `romFolderImport:openImporter` e recebido
- **THEN** o modal abre na secao `biblioteca`

#### Scenario: Abrir gerenciador de plataformas

- **WHEN** o canal `library:openPlatformManager` e recebido
- **THEN** o modal abre na secao `plataformas`

#### Scenario: Secao de backup

- **WHEN** o usuario navega para `backup`
- **THEN** o modal exibe a UI de portabilidade de dados com as categorias atuais do app

### Requirement: NotificationCenter

O NotificationCenter SHALL consolidar jobs em background de importacao de ROMs, sincronizacao de midia e portabilidade de dados.

#### Scenario: Job em andamento

- **WHEN** qualquer um desses jobs esta ativo
- **THEN** a central exibe card com progresso, etapa e mensagem contextual

#### Scenario: Job concluido

- **WHEN** um job termina com sucesso ou falha
- **THEN** o card correspondente passa a mostrar o resumo final e pode ser descartado pelo usuario
