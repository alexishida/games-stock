## ADDED Requirements

### Requirement: Cadastro de item de hardware
O sistema SHALL permitir cadastrar itens físicos de hardware com os seguintes campos obrigatórios: `name` (texto), `platform_id` (FK para plataformas existentes), `item_type_id` (FK para tipos de item), `conservation_state_id` (FK para estados de conservação), `description` (texto longo). Os campos opcionais SHALL ser: `acquisition_date` (data), `acquisition_url` (URL), `color` (texto), `value` (decimal), `serial_number` (texto), `region` (texto), `storage_location` (texto), `loan_to` (texto com nome da pessoa para quem emprestou).

#### Scenario: Criar item com campos obrigatórios
- **WHEN** o usuário preenche nome, plataforma, tipo, condição e descrição e confirma
- **THEN** o item é salvo no banco e aparece na grade de inventário

#### Scenario: Tentar salvar sem campo obrigatório
- **WHEN** o usuário tenta salvar sem preencher algum campo obrigatório
- **THEN** o formulário exibe erro de validação e não persiste o item

#### Scenario: Criar item com campos opcionais
- **WHEN** o usuário preenche campos opcionais como valor, cor e número de série
- **THEN** os dados são salvos e exibidos no painel de detalhe do item

### Requirement: Tipos de item configuráveis
O sistema SHALL fornecer tipos de item pré-cadastrados como defaults: "Console", "Controle", "Cabo de Energia", "Cabo de Vídeo", "Cartucho/Mídia", "Memória/Memory Card", "Acessório" e "Outros". O usuário SHALL poder cadastrar novos tipos e eles SHALL aparecer no seletor do formulário.

#### Scenario: Selecionar tipo pré-cadastrado
- **WHEN** o usuário abre o seletor de tipo no formulário
- **THEN** os tipos default aparecem na lista para seleção imediata

#### Scenario: Cadastrar novo tipo
- **WHEN** o usuário digita um novo tipo não existente e confirma
- **THEN** o tipo é salvo na tabela `item_types` e fica disponível para todos os itens futuros

### Requirement: Estados de conservação configuráveis
O sistema SHALL fornecer estados de conservação pré-cadastrados: "Novo", "Ótimo", "Bom", "Ruim" e "Com Defeito". O usuário SHALL poder cadastrar novos estados e eles SHALL aparecer no seletor do formulário.

#### Scenario: Selecionar estado pré-cadastrado
- **WHEN** o usuário abre o seletor de condição no formulário
- **THEN** os cinco estados default aparecem para seleção

#### Scenario: Cadastrar novo estado
- **WHEN** o usuário digita um estado não existente e confirma
- **THEN** o estado é salvo em `conservation_states` e fica disponível globalmente

### Requirement: Galeria de fotos por item
O sistema SHALL permitir adicionar múltiplas fotos a um item de hardware. As fotos SHALL ser copiadas para `%APPDATA%/gamestock/inventario/images/{item_id}/` pelo processo main, com nome de arquivo gerado por UUID v4 preservando a extensão original (ex: `a3f7c2d1-....jpg`), garantindo unicidade. A primeira foto na ordem de `sort_order` SHALL ser usada como imagem de capa do card. O usuário SHALL poder remover fotos individualmente.

#### Scenario: Adicionar foto
- **WHEN** o usuário clica em adicionar foto e seleciona um arquivo de imagem
- **THEN** o arquivo é copiado para `%APPDATA%/gamestock/inventario/images/{item_id}/{uuid}.{ext}` e a foto aparece na galeria do item

#### Scenario: Foto de capa no card
- **WHEN** um item possui fotos cadastradas
- **THEN** a foto com menor `sort_order` é exibida como imagem no card de inventário

#### Scenario: Item sem foto
- **WHEN** um item não possui fotos
- **THEN** o card exibe placeholder com ícone de hardware e nome do tipo

#### Scenario: Remover foto
- **WHEN** o usuário remove uma foto na galeria
- **THEN** o arquivo é deletado do disco e a entrada removida da tabela `hardware_item_photos`

#### Scenario: Deletar item remove fotos
- **WHEN** o usuário confirma a exclusão de um item
- **THEN** todos os arquivos de foto do diretório `userData/hardware-photos/{item_id}/` são deletados junto com o item

### Requirement: Grade de cards de inventário
O sistema SHALL exibir os itens de hardware em grade de cards similar à biblioteca de jogos. Cada card SHALL exibir: foto de capa (ou placeholder), nome do item, badge de plataforma, tipo do item e badge de condição com cor representativa. A grade SHALL usar paginação de 50 itens por página.

#### Scenario: Card com foto
- **WHEN** um item possui foto cadastrada
- **THEN** o card exibe a foto de capa com proporção preservada

#### Scenario: Card sem foto
- **WHEN** um item não tem foto
- **THEN** o card exibe placeholder com ícone e nome do tipo de item

#### Scenario: Paginação da grade
- **WHEN** o inventário tem mais de 50 itens
- **THEN** o componente Pagination exibe navegação de páginas

### Requirement: Busca e filtros no inventário
O sistema SHALL permitir filtrar itens por plataforma, tipo de item e estado de conservação. O campo de busca SHALL filtrar em tempo real pelo nome do item de forma case-insensitive. Filtros SHALL ser combináveis.

#### Scenario: Filtrar por plataforma
- **WHEN** o usuário seleciona uma plataforma no painel lateral do inventário
- **THEN** a grade exibe apenas itens associados àquela plataforma

#### Scenario: Filtrar por tipo de item
- **WHEN** o usuário seleciona um tipo (ex: "Controle") no painel lateral
- **THEN** a grade exibe apenas itens daquele tipo

#### Scenario: Filtrar por condição
- **WHEN** o usuário seleciona um estado de conservação
- **THEN** a grade exibe apenas itens naquela condição

#### Scenario: Busca por nome
- **WHEN** o usuário digita no campo de busca do inventário
- **THEN** a grade filtra itens cujo nome contém o texto digitado

#### Scenario: Combinar filtros
- **WHEN** plataforma e tipo estão selecionados simultaneamente
- **THEN** a grade exibe apenas itens que satisfazem ambos os filtros

### Requirement: Detalhe e edição de item
O sistema SHALL exibir um painel de detalhe ao clicar em um card de inventário, mostrando todos os campos preenchidos e a galeria de fotos completa. O usuário SHALL poder editar e deletar o item a partir desse painel.

#### Scenario: Abrir detalhe
- **WHEN** o usuário clica em um card
- **THEN** o painel de detalhe abre exibindo todos os campos e a galeria de fotos

#### Scenario: Editar item
- **WHEN** o usuário clica em editar no detalhe e altera campos
- **THEN** as alterações são salvas e o detalhe atualiza com os novos dados

#### Scenario: Deletar item com confirmação
- **WHEN** o usuário clica em deletar e confirma
- **THEN** o item é removido do banco, o subdiretório `%APPDATA%/gamestock/inventario/images/{item_id}/` é deletado e a grade atualiza

### Requirement: Backup e restauração do inventário
O sistema SHALL incluir os dados do inventário físico como categoria independente `inventoryImages` no pacote `.gamestock-backup`, separada das demais categorias (metadata, images, platforms, romLocations). A categoria SHALL cobrir metadados SQLite (`hardware_items`, `item_types`, `conservation_states`, `hardware_item_photos`) e os arquivos de imagem em `%APPDATA%/gamestock/inventario/images/`.

Na importação, os caminhos de imagem SHALL ser regravados para o diretório de dados da máquina de destino. O matching de itens SHALL usar `name + platform.name` como chave estável, sem depender de IDs SQLite do pacote de origem.

#### Scenario: Exportar inventário no backup
- **WHEN** o usuário seleciona a categoria "Inventário" na tela de exportação em Configurações > Geral
- **THEN** o pacote inclui os metadados SQLite do inventário e todos os arquivos de imagem de `%APPDATA%/gamestock/inventario/images/`

#### Scenario: Importar inventário do backup
- **WHEN** o usuário importa um pacote contendo a categoria "Inventário"
- **THEN** os itens são inseridos no banco por matching `name + platform.name`, as imagens são copiadas para o diretório local e os `file_path` são atualizados para os caminhos da máquina de destino

#### Scenario: Categoria inventário independente das outras
- **WHEN** o usuário seleciona apenas "Inventário" para exportar
- **THEN** o pacote contém apenas dados do inventário, sem jogos, capas ou plataformas
