# rom-folder-import - Especificação

## Purpose
Define o assistente de importação em lote por pastas de ROMs, com seleção de plataforma, revisão, execução em background, notificações e resumo de resultados.

## Requirements
### Requirement: Assistente de importação de ROMs por pasta
O sistema SHALL fornecer um fluxo guiado que permite selecionar uma ou mais pastas locais ou arquivos ROM individuais, selecionar uma plataforma, revisar ROMs descobertas e iniciar importação em lote.

#### Scenario: Iniciar importação por pasta
- **WHEN** o usuário abre a ação de importação pela UI da biblioteca
- **THEN** o sistema exibe um assistente com seleção de pasta, seleção de plataforma, revisão, progresso e resultados

#### Scenario: Selecionar pastas de ROMs
- **WHEN** o usuário escolhe uma ou mais pastas pelo seletor nativo
- **THEN** o assistente armazena caminhos absolutos e só prossegue se pelo menos uma pasta foi selecionada

#### Scenario: Lista de seleção antes da plataforma
- **WHEN** o usuário abre a primeira tela do assistente
- **THEN** o assistente exibe somente pastas ou arquivos selecionados antes da etapa de plataforma

#### Scenario: Selecionar plataforma depois dos arquivos
- **WHEN** o usuário avança após selecionar pastas ou arquivos
- **THEN** o assistente exibe a seleção de plataforma antes de escanear ROMs

#### Scenario: Pré-preencher caminhos anteriores
- **WHEN** o usuário abre o assistente após usá-lo antes
- **THEN** a lista é preenchida com os últimos caminhos salvos

#### Scenario: Resumo inicial de importações salvas
- **WHEN** o usuário abre o assistente
- **THEN** a primeira tela mostra tabela de pastas em uso com caminho, plataforma e quantidade de jogos indexados

#### Scenario: Adicionar pasta a partir do resumo
- **WHEN** o usuário clica em "Adicionar Pasta" na tela inicial
- **THEN** o assistente navega para a configuração em vez de abrir o seletor nativo imediatamente

#### Scenario: Deletar pasta a partir do resumo
- **WHEN** o usuário seleciona uma linha e clica em "Deletar Pasta"
- **THEN** a pasta é removida da tabela salva e os jogos com `rom_path` dentro dela são removidos da biblioteca

#### Scenario: Pasta física preservada
- **WHEN** o usuário deleta uma pasta do GameStock
- **THEN** o sistema MUST NOT apagar a pasta física nem os arquivos ROM do disco

#### Scenario: Formulário de adicionar pasta
- **WHEN** o usuário abre a tela de configuração
- **THEN** o assistente exibe campos de seleção de pasta e plataforma

#### Scenario: Selecionar arquivos ROM individuais
- **WHEN** o usuário escolhe uma ou mais ROMs pelo seletor nativo
- **THEN** o assistente adiciona os caminhos à lista e os inclui no scan/importação

#### Scenario: Selecionar plataforma de importação
- **WHEN** o usuário escolhe uma plataforma da lista configurada
- **THEN** essa plataforma é usada para todas as ROMs do lote atual

### Requirement: Descoberta de ROMs em pastas selecionadas
O sistema SHALL escanear as pastas selecionadas, detectar ROMs suportadas e derivar um título candidato para cada arquivo.

#### Scenario: Descobrir ROMs suportadas
- **WHEN** a pasta contém arquivos com extensões suportadas
- **THEN** o sistema retorna candidatos com `folderPath`, `romPath`, nome original, título normalizado e plataforma selecionada

#### Scenario: Ignorar arquivos não suportados
- **WHEN** a pasta contém arquivos com extensões não suportadas
- **THEN** esses arquivos são ignorados e não entram na lista de candidatos

#### Scenario: Pasta vazia
- **WHEN** a pasta não contém ROMs suportadas
- **THEN** o assistente exibe estado vazio e não permite iniciar importação

### Requirement: Progresso e resumo da importação em lote
O sistema SHALL reportar progresso da importação e contagens finais ao renderer.

#### Scenario: Progresso durante importação
- **WHEN** uma importação em lote está rodando
- **THEN** o renderer recebe job ID, item atual, total, pasta atual, ROM atual, estágio atual e imagem opcional

#### Scenario: Importação em background
- **WHEN** o usuário inicia o lote revisado
- **THEN** a janela de importação fecha e downloads de metadados/imagens continuam em background

#### Scenario: Notificações em background
- **WHEN** a importação em background emite progresso ou conclusão
- **THEN** a área de notificações exibe status, progresso e resumo final

#### Scenario: Continuar downloads pela tela inicial
- **WHEN** o usuário seleciona uma pasta inicial e clica em "Continuar downloads"
- **THEN** o sistema inicia importação em background para aquela pasta usando sua plataforma salva e fecha a janela

#### Scenario: Resumo de importação
- **WHEN** o lote termina
- **THEN** o assistente exibe criados, atualizados, ignorados, sem match, downloads com falha e total processado

#### Scenario: Cancelar antes de gravar
- **WHEN** o usuário cancela na revisão antes de iniciar
- **THEN** nenhum jogo é criado ou atualizado e nenhuma imagem é baixada
