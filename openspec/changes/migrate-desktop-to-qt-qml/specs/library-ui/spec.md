<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: SettingsModal

O modal de configuracoes SHALL navegar entre as secoes `plataformas`, `emuladores`, `biblioteca`, `covers`, `partidas`, `backup` e `sobre`.

#### Scenario: Abrir importador de pastas

- **WHEN** a ação de navegação para o importador é acionada
- **THEN** o modal abre na secao `biblioteca`

#### Scenario: Abrir gerenciador de plataformas

- **WHEN** a ação de navegação para plataformas é acionada
- **THEN** o modal abre na secao `plataformas`

#### Scenario: Secao de backup

- **WHEN** o usuario navega para `backup`
- **THEN** o modal exibe a UI de portabilidade de dados com as categorias atuais do app



