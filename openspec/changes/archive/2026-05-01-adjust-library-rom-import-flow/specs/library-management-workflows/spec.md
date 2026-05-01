# library-management-workflows - Especificação

## Purpose
Define fluxos de uso para manter a biblioteca no dia a dia: criar jogos manualmente, excluir jogos, marcar status de coleção e importar muitos jogos por pasta de ROMs.

## Requirements
### Requirement: Fluxo de criação manual de jogos
O sistema SHALL permitir criar um jogo manualmente pela UI da biblioteca sem usar a importação LaunchBox. O formulário SHALL exigir título e plataforma e permitir campos opcionais como publisher, ano, gênero, rating, notas, posse física, condição física, ROM e box art.

#### Scenario: Criar jogo com campos obrigatórios
- **WHEN** o usuário abre o formulário, informa título, seleciona plataforma e salva
- **THEN** o jogo é persistido, a biblioteca é atualizada e o jogo criado pode ser selecionado na grade ou lista

#### Scenario: Campos obrigatórios ausentes
- **WHEN** o usuário tenta salvar um jogo sem título ou plataforma
- **THEN** o formulário exibe erro de validação e nenhum jogo é criado

### Requirement: Fluxo de exclusão de jogo
O sistema SHALL permitir excluir um jogo selecionado a partir da tela de detalhes após confirmação da ação destrutiva.

#### Scenario: Confirmar exclusão de jogo
- **WHEN** o usuário clica para excluir um jogo selecionado e confirma
- **THEN** o jogo é removido do banco, o painel de detalhes fecha e a biblioteca é atualizada

#### Scenario: Cancelar exclusão de jogo
- **WHEN** o usuário clica para excluir um jogo selecionado e cancela a confirmação
- **THEN** o jogo permanece inalterado e selecionado

### Requirement: Fluxo de status da coleção
O sistema SHALL permitir marcar um jogo como favorito e definir `play_status` como `unplayed`, `playing` ou `completed`. Esses valores SHALL ser persistidos e disponíveis como filtros da biblioteca.

#### Scenario: Marcar jogo como favorito
- **WHEN** o usuário habilita favorito em um jogo e salva
- **THEN** o jogo permanece marcado como favorito após refresh ou reinício do app

#### Scenario: Definir status concluído
- **WHEN** o usuário define `play_status = "completed"` e salva
- **THEN** o jogo aparece quando o filtro de concluídos está ativo

### Requirement: Fluxo de importação por pasta de ROMs
O sistema SHALL oferecer um fluxo de biblioteca para importar muitos jogos de uma pasta de ROMs como alternativa ao cadastro manual e à importação individual LaunchBox.

#### Scenario: Importar pasta pela biblioteca
- **WHEN** o usuário inicia "Importar pasta de ROMs" pela área de ferramentas da biblioteca
- **THEN** o sistema abre o assistente de importação sem perder filtros ou seleção atuais

#### Scenario: Revisar antes de importar
- **WHEN** ROMs foram descobertas e uma plataforma foi selecionada
- **THEN** o assistente exibe quantidade de ROMs, plataforma selecionada e títulos antes de iniciar a importação

#### Scenario: Atualizar biblioteca após importação
- **WHEN** a importação por pasta conclui com jogos criados ou atualizados
- **THEN** a biblioteca é atualizada e exibe os jogos conforme os filtros ativos

#### Scenario: Reportar ROMs sem match
- **WHEN** uma ou mais ROMs não têm correspondência LaunchBox
- **THEN** o fluxo reporta essas ROMs no resultado final em vez de descartá-las silenciosamente
