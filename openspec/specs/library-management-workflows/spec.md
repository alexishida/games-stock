# library-management-workflows - Especificação

## Purpose
Define fluxos de uso para manter a biblioteca no dia a dia: criar jogos manualmente, editar e excluir jogos, marcar status de coleção, associar ROMs e importar muitos jogos por pasta de ROMs.

## Requirements
### Requirement: Fluxo de criação manual de jogos
O sistema SHALL permitir criar um jogo manualmente via ManualGameModal sem usar a importação LaunchBox. O formulário SHALL exigir título e plataforma e permitir campos opcionais como publisher, ano, gênero, rating, notas, favorito e status de play.

#### Scenario: Criar jogo com campos obrigatórios
- **WHEN** o usuário abre o ManualGameModal, informa título, seleciona plataforma e salva
- **THEN** o jogo é persistido, o modal fecha, o jogo recém-criado é selecionado e o GameDetail é aberto

#### Scenario: Campos obrigatórios ausentes
- **WHEN** o usuário tenta salvar um jogo sem título ou sem plataforma selecionada
- **THEN** o formulário exibe erro de validação e nenhum jogo é criado

#### Scenario: Abrir ManualGameModal
- **WHEN** o canal IPC `library:openCreateGame` é recebido pelo renderer
- **THEN** o ManualGameModal é aberto

### Requirement: Fluxo de edição de jogo
O sistema SHALL permitir editar campos de um jogo selecionado pelo GameForm dentro do GameDetail. O formulário SHALL exibir os valores atuais e salvar apenas os campos alterados.

#### Scenario: Editar campos de metadados
- **WHEN** o usuário altera título, publisher, ano, gênero, rating ou notas no GameForm e clica em "Salvar"
- **THEN** o jogo é atualizado no banco e o GameDetail exibe os novos valores

#### Scenario: Editar status de coleção
- **WHEN** o usuário altera o favorito (checkbox) ou o play_status (select) e salva
- **THEN** os novos valores são persistidos e os filtros de coleção passam a refletir a mudança

### Requirement: Fluxo de exclusão de jogo
O sistema SHALL permitir excluir um jogo selecionado a partir do GameDetail após confirmação da ação destrutiva.

#### Scenario: Confirmar exclusão de jogo
- **WHEN** o usuário clica em "Excluir" no GameDetail e confirma
- **THEN** o jogo é removido do banco, o GameDetail fecha (deseleciona o jogo) e a biblioteca é atualizada

#### Scenario: Cancelar exclusão de jogo
- **WHEN** o usuário clica em "Excluir" mas cancela a confirmação
- **THEN** o jogo permanece inalterado e selecionado

### Requirement: Fluxo de status da coleção
O sistema SHALL permitir marcar um jogo como favorito e definir `play_status` como `"unplayed"`, `"playing"` ou `"completed"`. Esses valores SHALL ser persistidos e disponíveis como filtros da biblioteca.

#### Scenario: Marcar jogo como favorito
- **WHEN** o usuário ativa o checkbox favorito no GameForm e salva
- **THEN** o jogo aparece no filtro de favoritos e persiste entre sessões

#### Scenario: Definir status concluído
- **WHEN** o usuário seleciona `play_status = "completed"` no GameForm e salva
- **THEN** o jogo aparece quando o filtro de concluídos está ativo

### Requirement: Acesso ao GameDetail
O sistema SHALL exibir o GameDetail quando o usuário seleciona um jogo na grade ou na lista. A TopBar SHALL ser ocultada durante a exibição do detalhe e restaurada ao voltar.

#### Scenario: Abrir GameDetail
- **WHEN** o usuário clica em um card na grade ou em uma linha na lista
- **THEN** a TopBar desaparece e o GameDetail ocupa a área principal com imagem hero, metadados e formulário de edição

#### Scenario: Voltar para biblioteca
- **WHEN** o usuário clica em "Voltar para biblioteca" no GameDetail
- **THEN** o jogo é deselecionado, a TopBar reaparece e a grade/lista é restaurada

### Requirement: Fluxo de importação por pasta de ROMs
O sistema SHALL oferecer o RomFolderImporter dentro do SettingsModal para importar muitos jogos de pastas de ROMs como alternativa ao cadastro manual.

#### Scenario: Acessar RomFolderImporter
- **WHEN** o usuário abre "Gerenciar biblioteca" na Sidebar ou aciona o canal `romFolderImport:openImporter`
- **THEN** o SettingsModal abre na seção "biblioteca" exibindo o RomFolderImporter sem perder filtros ou seleção da biblioteca

#### Scenario: Revisar antes de importar
- **WHEN** ROMs foram descobertas e a plataforma foi selecionada
- **THEN** o assistente exibe quantidade de ROMs encontradas, arquivos ignorados e lista de candidatos antes de iniciar

#### Scenario: Atualizar biblioteca após importação
- **WHEN** o job de importação em background conclui
- **THEN** a biblioteca é recarregada e os jogos criados/atualizados aparecem conforme os filtros ativos

#### Scenario: Reportar ROMs sem match
- **WHEN** uma ou mais ROMs não têm correspondência LaunchBox com score suficiente
- **THEN** o resumo final reporta essas ROMs como "sem match" em vez de descartá-las silenciosamente
