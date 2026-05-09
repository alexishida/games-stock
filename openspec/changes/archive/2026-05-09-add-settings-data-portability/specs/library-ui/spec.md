## MODIFIED Requirements

### Requirement: SettingsModal
O sistema SHALL fornecer um modal de configuracoes com navegacao entre as secoes "geral", "biblioteca", "plataformas", "emuladores", "covers" e "sobre". O modal SHALL ser acessivel pelo botao do painel lateral e pelos canais IPC `library:openPlatformManager` e `romFolderImport:openImporter`. A secao "geral" SHALL incluir controles de portabilidade para exportar e importar dados do GameStock.

#### Scenario: Abrir na secao biblioteca
- **WHEN** o canal `romFolderImport:openImporter` e recebido ou o usuario clica em "Gerenciar biblioteca"
- **THEN** o SettingsModal abre na secao "biblioteca" exibindo o RomFolderImporter

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
