# hardware-inventory Specification

## Purpose
Definir o inventario fisico de hardware: cadastro de itens, tipos e estados configuraveis, fotos por item, visualizacoes em cards/lista, filtros, detalhe e integracao com backup.

## Requirements
### Requirement: Cadastro de item de hardware

O sistema SHALL permitir cadastrar itens com `name`, plataforma ou marcador `is_multiplatform`, `item_type_id` e `conservation_state_id` como informacoes centrais. `description` SHALL ser opcional.

#### Scenario: Criar item minimo

- **WHEN** o usuario preenche nome, plataforma, tipo e condicao
- **THEN** o item e salvo e aparece no inventario

#### Scenario: Item multiplataforma

- **WHEN** o usuario escolhe a opcao interna `Multiplataforma`
- **THEN** o item e salvo com `platform_id = null` e `is_multiplatform = 1`, sem criar nova plataforma na biblioteca

### Requirement: Tipos e estados configuraveis

O sistema SHALL manter tipos e estados default e permitir a criacao de novos valores pelo usuario.

#### Scenario: Defaults disponiveis

- **WHEN** o formulario abre
- **THEN** tipos e estados default do inventario podem ser selecionados imediatamente

### Requirement: Galeria de fotos por item

As fotos SHALL ser copiadas para `inventario/images/<item_id>/`, ordenadas por `sort_order`, com a primeira foto servindo como capa do item.

#### Scenario: Adicionar foto

- **WHEN** o usuario adiciona uma imagem a um item ja salvo
- **THEN** o arquivo e copiado para o armazenamento do app e a galeria e atualizada

#### Scenario: Reordenar fotos

- **WHEN** o usuario move uma foto para cima ou para baixo
- **THEN** a ordem persistida muda e a foto de capa pode ser alterada

#### Scenario: Excluir item

- **WHEN** um item e removido
- **THEN** seus registros de foto e os arquivos fisicos do diretorio do item sao removidos

### Requirement: Listagem do inventario

O inventario SHALL oferecer visualizacoes em cards e lista, com pagina de 36 itens e ordenacao `name`, `type` ou `recent`.

#### Scenario: Alternar visualizacao

- **WHEN** o usuario troca entre cards e lista
- **THEN** a mesma consulta paginada e renderizada no formato escolhido

#### Scenario: Ordenacao rapida

- **WHEN** o usuario clica no icone de ordenar
- **THEN** o criterio cicla entre `name`, `type` e `recent`

### Requirement: Busca e filtros

A API SHALL aceitar filtros por `platformId`, `itemTypeId`, `conservationStateId` e busca textual. A UI atual da sidebar SHALL expor filtros de tipo e condicao, combinados com a busca do topo.

#### Scenario: Filtrar por tipo e condicao

- **WHEN** o usuario seleciona um tipo e uma condicao
- **THEN** a lista mostra apenas itens que atendem aos dois filtros

#### Scenario: Buscar por nome

- **WHEN** o usuario digita na busca do inventario
- **THEN** o filtro por nome e aplicado em tempo real com debounce curto

### Requirement: Detalhe e edicao

Selecionar um item SHALL abrir um painel de detalhe com fotos, campos preenchidos e acoes de editar ou excluir.

#### Scenario: Editar item

- **WHEN** o usuario salva alteracoes no formulario
- **THEN** o detalhe e recarregado com os dados atualizados

### Requirement: Backup do inventario

O inventario SHALL participar da portabilidade de dados pela categoria `inventoryImages`.

#### Scenario: Exportar inventario

- **WHEN** o usuario seleciona `inventoryImages`
- **THEN** o pacote inclui os metadados do inventario e as fotos em `inventory-media/`

#### Scenario: Importar inventario

- **WHEN** essa categoria e restaurada
- **THEN** itens e fotos sao reconciliados no armazenamento local do app
