# library-management-workflows Specification

## Purpose
Definir os fluxos de uso para manter a biblioteca no dia a dia: criar jogos, editar, excluir, marcar status, abrir detalhes e importar jogos por pasta de ROMs.

## Requirements
### Requirement: Criacao manual de jogos

O sistema SHALL permitir criar jogos manualmente via `ManualGameModal`.

#### Scenario: Criar jogo com campos obrigatorios

- **WHEN** o usuario informa titulo e plataforma e salva
- **THEN** o jogo e persistido, selecionado e o detalhe pode ser aberto em seguida

#### Scenario: Abrir modal por IPC

- **WHEN** o renderer recebe `library:openCreateGame`
- **THEN** o `ManualGameModal` e aberto

### Requirement: Edicao e status de colecao

O GameDetail SHALL permitir editar metadados, favorito e `play_status`.

#### Scenario: Atualizar favorito ou status

- **WHEN** o usuario altera favorito, `playing` ou `completed`
- **THEN** os filtros da biblioteca passam a refletir a mudanca apos recarga

### Requirement: Exclusao de jogo

O sistema SHALL permitir excluir um jogo a partir do detalhe com confirmacao explicita.

#### Scenario: Exclusao confirmada

- **WHEN** o usuario confirma a exclusao
- **THEN** o jogo e removido, o detalhe fecha e a biblioteca e recarregada

### Requirement: Navegacao para o detalhe

Selecionar um jogo na grade ou lista SHALL abrir o `GameDetail`, com navegacao entre jogos da pagina atual e das paginas vizinhas.

#### Scenario: Abrir e voltar

- **WHEN** o usuario seleciona um jogo e depois volta para `Biblioteca`
- **THEN** a selecao e limpa e a listagem principal volta a ser exibida

### Requirement: Importacao por pasta de ROMs

O `RomFolderImporter` SHALL ficar dentro da secao `biblioteca` do SettingsModal como principal fluxo de importacao em massa.

#### Scenario: Acessar o importador

- **WHEN** o usuario clica em `Configuracoes` e entra em `Biblioteca`, ou o canal `romFolderImport:openImporter` e recebido
- **THEN** o SettingsModal mostra o `RomFolderImporter`

#### Scenario: Revisar candidatos antes de importar

- **WHEN** o scan encontra ROMs e resolve uma plataforma
- **THEN** a UI mostra quantidade de ROMs encontradas, itens ignorados e candidatos antes do job final

#### Scenario: Biblioteca recarregada apos job

- **WHEN** o job de importacao conclui
- **THEN** jogos e plataformas sao recarregados e os resultados aparecem sob os filtros atuais
