<!-- Delta sincronizado com o estado nativo consolidado; não implica arquivamento. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: TopBar da biblioteca

No modo `library`, o sistema SHALL exibir uma TopBar com busca, alternancia de visualizacao, ordenacao rapida e contador `Exibindo X de Y jogos`.

#### Scenario: Ordenacao rapida

- **WHEN** o usuario clica no icone de ordenar da TopBar
- **THEN** a ordenacao cicla entre `title`, `year` e `recent`

#### Scenario: Busca preservada no detalhe

- **WHEN** um jogo esta selecionado ou o app esta no modo inventario
- **THEN** o detalhe pode manter apenas a busca; o inventário usa sua própria barra com o mesmo padrão visual

### Requirement: Header principal da biblioteca

Quando nenhum jogo esta selecionado, a area principal SHALL exibir seletor de categoria por genero e ordenacao completa; as colecoes ficam na sidebar.

#### Scenario: Abas de colecao disponiveis

- **WHEN** a biblioteca principal esta aberta
- **THEN** o usuario encontra na sidebar as colecoes `Todos os jogos`, `Mais Jogados`, `Favoritos`, `Jogando` e `Concluido`

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
- **THEN** o modal abre na secao `sobre`

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

O modal de configuracoes SHALL navegar entre as secoes `plataformas`, `emuladores`, `biblioteca`, `covers`, `partidas`, `backup`, `logs` e `sobre`.

#### Scenario: Abrir importador de pastas

- **WHEN** a ação de navegação para o importador é acionada
- **THEN** o modal abre na secao `biblioteca`

#### Scenario: Abrir gerenciador de plataformas

- **WHEN** a ação de navegação para plataformas é acionada
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

### Requirement: Fidelidade visual entre runtimes

O sistema SHALL preservar a identidade do aplicativo atual, incluindo cores, tipografia efetiva da referência por SO, ícones Lucide, layouts, imagens, espaçamentos, estados e efeitos. Capturas comparativas SHALL usar os mesmos dados, resolução e escala, sem redesenho implícito durante a migração.

#### Scenario: Comparação da biblioteca
- **WHEN** biblioteca, lista, detalhe, inventário e configurações são comparados com a referência Electron
- **THEN** os tokens visuais coincidem, a geometria estática difere no máximo 2 pixels lógicos e não há cortes, sobreposição indevida ou controles inacessíveis

#### Scenario: Variação de tamanho e escala
- **WHEN** o app é usado em 1024x768, 1122x957 e 1920x1080, nas escalas 100%, 125% e 150%
- **THEN** os fluxos continuam utilizáveis e diferenças de rasterização são registradas separadamente das diferenças de layout

#### Scenario: Efeitos do tema
- **WHEN** overlays, cards e navegação exibem gradientes, sombras, transparência e desfoque
- **THEN** a composição mantém o efeito visual de referência nos sistemas suportados, sem substituição silenciosa por outro estilo

### Requirement: Modais internos e interacoes preservadas

O sistema SHALL manter formulários, confirmações e assistentes como overlays arrastáveis na janela principal, com escurecimento por camada e ações à direita. Controles interativos SHALL preservar clique, seleção e foco sem iniciar drag.

#### Scenario: Arrastar modal empilhado
- **WHEN** o usuário arrasta o corpo de um modal sobre outro
- **THEN** o modal superior se move dentro da área visível, a camada inferior fica escurecida e seus controles não recebem interação indevida

#### Scenario: Teclado e controles
- **WHEN** o usuário navega por Tab, usa Escape ou interage com um campo de formulário
- **THEN** foco e fechamento seguem o fluxo existente, sem iniciar arraste ou perder dados indevidamente

### Requirement: Controles independentes de colecoes

Biblioteca e inventário SHALL oferecer busca, ordenação, contador e visualizações cards/lista, mantendo suas preferências independentes e os padrões de altura e alinhamento da barra de busca atual.

#### Scenario: Alternar visualização do inventário
- **WHEN** o usuário muda o inventário de cards para lista
- **THEN** a biblioteca conserva sua própria visualização e os contadores refletem o conjunto filtrado de cada coleção

### Requirement: Preservação do design e layout aprovados

O sistema SHALL tratar a interface Qt/QML atual como referência visual aprovada pelo usuário. Correções e funcionalidades SHALL reutilizar Theme.qml e componentes existentes, preservando identidade, hierarquia, densidade, geometria, efeitos e organização das telas. Redesenho SHALL depender de solicitação explícita.

#### Scenario: Manutenção de uma tela existente
- **WHEN** uma correção ou funcionalidade é adicionada
- **THEN** cores, Inter local, ícones Lucide locais, espaçamentos, cards/lista e navegação permanecem consistentes com a interface aprovada

#### Scenario: Divergência entre guia e implementação aprovada
- **WHEN** uma descrição histórica difere da geometria atual
- **THEN** a implementação nativa e Theme.qml são a referência efetiva, incluindo sidebar de 240 px, fundo #131313 e busca de 34 px com máximo 480 px, sem redesenho implícito

#### Scenario: Verificação visual de mudança
- **WHEN** uma alteração afeta a interface
- **THEN** capturas com perfil sintético, mesma resolução e escala são comparadas com artifacts/native-migration, verificando ausência de cortes, sobreposições e perda de acesso aos controles
