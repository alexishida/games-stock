<!-- Delta sincronizado com o estado nativo consolidado; não implica arquivamento. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Criacao manual de jogos

O sistema SHALL permitir criar jogos manualmente via `ManualGameModal`.

#### Scenario: Criar jogo com campos obrigatorios

- **WHEN** o usuario informa titulo e plataforma e salva
- **THEN** o jogo e persistido, selecionado e o detalhe pode ser aberto em seguida

#### Scenario: Abrir formulário pela navegação nativa

- **WHEN** a interface recebe `library:openCreateGame`
- **THEN** o `ManualGameModal` e aberto

### Requirement: Importacao por pasta de ROMs

O `RomFolderImporter` SHALL ficar dentro da secao `biblioteca` do SettingsModal como principal fluxo de importacao em massa.

#### Scenario: Acessar o importador

- **WHEN** o usuario clica em `Configuracoes` e entra em `Biblioteca`, ou a ação de navegação para o importador é acionada
- **THEN** o SettingsModal mostra o `RomFolderImporter`

#### Scenario: Revisar candidatos antes de importar

- **WHEN** o scan encontra ROMs e resolve uma plataforma
- **THEN** a UI mostra quantidade de ROMs encontradas, itens ignorados e candidatos antes do job final

#### Scenario: Biblioteca recarregada apos job

- **WHEN** o job de importacao conclui
- **THEN** jogos e plataformas sao recarregados e os resultados aparecem sob os filtros atuais
