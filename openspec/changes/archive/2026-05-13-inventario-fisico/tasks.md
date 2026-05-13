## 1. Banco de Dados — Schema e Migration

- [x] 1.1 Criar migration em `src/main/db/database.ts`: tabela `item_types` (id, name, is_default)
- [x] 1.2 Criar migration: tabela `conservation_states` (id, name, is_default)
- [x] 1.3 Criar migration: tabela `hardware_items` (id, name, platform_id, item_type_id, conservation_state_id, description, acquisition_date, acquisition_url, color, value, serial_number, region, storage_location, loan_to, created_at, updated_at)
- [x] 1.4 Criar migration: tabela `hardware_item_photos` (id, item_id FK, file_path, sort_order, created_at)
- [x] 1.5 Inserir seeds dos defaults: 8 tipos de item e 5 estados de conservação com `is_default = 1`

## 2. DAOs

- [x] 2.1 Criar `src/main/db/dao/hardwareItemTypeDao.ts` com list, create, delete
- [x] 2.2 Criar `src/main/db/dao/hardwareConservationStateDao.ts` com list, create, delete
- [x] 2.3 Criar `src/main/db/dao/hardwareItemDao.ts` com list (com filtros: platform_id, item_type_id, conservation_state_id, search), get, create, update, delete
- [x] 2.4 Criar `src/main/db/dao/hardwareItemPhotoDao.ts` com listByItem, create, delete, reorder

## 3. IPC Channels e Handlers

- [x] 3.1 Adicionar namespace `hardwareInventory` em `src/shared/ipc-channels.ts` com canais: `items:list`, `items:get`, `items:create`, `items:update`, `items:delete`, `types:list`, `types:create`, `types:delete`, `states:list`, `states:create`, `states:delete`, `photos:list`, `photos:add`, `photos:remove`
- [x] 3.2 Registrar todos os handlers em `src/main/index.ts` chamando os DAOs correspondentes
- [x] 3.3 Implementar handler `photos:add`: receber path origem, gerar UUID v4, copiar para `%APPDATA%/gamestock/inventario/images/{item_id}/{uuid}.{ext}`, retornar novo registro com caminho absoluto
- [x] 3.4 Implementar handler `items:delete`: além de deletar do banco, remover subdiretório `%APPDATA%/gamestock/inventario/images/{item_id}/` inteiro se existir

## 4. Preload e Tipos

- [x] 4.1 Expor namespace `hardwareInventory` em `src/preload/index.ts` via `contextBridge` com todos os canais do namespace
- [x] 4.2 Adicionar tipos `HardwareItem`, `HardwareItemType`, `ConservationState`, `HardwareItemPhoto`, `HardwareItemFilters` em `src/preload/types.d.ts`

## 5. Componentes React — Formulário e Tipos/Estados

- [x] 5.1 Criar `src/renderer/components/HardwareInventory/HardwareItemTypeSelector.tsx`: seletor com lista de tipos + input para criar novo tipo inline
- [x] 5.2 Criar `src/renderer/components/HardwareInventory/ConservationStateSelector.tsx`: seletor com lista de estados + input para criar novo estado inline
- [x] 5.3 Criar `src/renderer/components/HardwareInventory/HardwareItemForm.tsx`: formulário completo com campos obrigatórios, seção expansível de campos opcionais e galeria de fotos
- [x] 5.4 Criar `src/renderer/components/HardwareInventory/HardwareItemForm.css` seguindo DESIGN.md

## 6. Componentes React — Card e Grade

- [x] 6.1 Criar `src/renderer/components/HardwareInventory/HardwareItemCard.tsx`: card com foto/placeholder, nome, badge de plataforma, tipo e badge de condição
- [x] 6.2 Criar `src/renderer/components/HardwareInventory/HardwareItemCard.css` seguindo padrão visual dos cards da biblioteca
- [x] 6.3 Criar `src/renderer/components/HardwareInventory/HardwareInventoryGrid.tsx`: grade paginada de 50 itens reutilizando componente `Pagination` existente
- [x] 6.4 Criar `src/renderer/components/HardwareInventory/HardwareInventoryGrid.css`

## 7. Componentes React — Detalhe e Galeria

- [x] 7.1 Criar `src/renderer/components/HardwareInventory/HardwareItemDetail.tsx`: painel de detalhe com todos os campos, galeria de fotos, botões editar e deletar
- [x] 7.2 Implementar galeria de fotos no detalhe com navegação entre imagens e botões de remover/reordenar
- [x] 7.3 Criar `src/renderer/components/HardwareInventory/HardwareItemDetail.css`

## 8. Componente Principal do Módulo

- [x] 8.1 Criar `src/renderer/components/HardwareInventory/HardwareInventory.tsx`: orquestra busca, filtros, grade e detalhe; gerencia estado local de item selecionado
- [x] 8.2 Criar `src/renderer/components/HardwareInventory/HardwareInventory.css`
- [x] 8.3 Criar `src/renderer/components/HardwareInventory/index.ts` exportando o componente principal

## 9. Store Zustand — Modo da Sidebar

- [x] 9.1 Adicionar `sidebarMode: 'library' | 'inventory'` ao store em `src/renderer/store/index.ts` com action `setSidebarMode`
- [x] 9.2 Adicionar estado de filtros do inventário ao store: `inventoryFilters: { platformId, itemTypeId, conservationStateId, search }` com action `setInventoryFilters`

## 10. Sidebar — Modo Contextual

- [x] 10.1 Atualizar `src/renderer/components/Sidebar/Sidebar.tsx`: renderizar conteúdo diferente por `sidebarMode` (árvore de plataformas em `library`; filtros de inventário em `inventory`)
- [x] 10.2 Implementar filtros do inventário na sidebar: lista de plataformas com itens, lista de tipos, lista de estados
- [x] 10.3 Adicionar botões "Biblioteca" e "Inventário" fixos na sidebar (sempre visíveis em ambos os modos) com destaque no modo ativo
- [x] 10.4 Garantir que botão "Configurar" permanece visível em ambos os modos
- [x] 10.5 Atualizar `Sidebar.css` para os novos elementos

## 11. Integração no App

- [x] 11.1 Atualizar componente raiz (`App.tsx` ou equivalente) para renderizar `HardwareInventory` quando `sidebarMode === 'inventory'` e `GameLibrary` quando `sidebarMode === 'library'`
- [x] 11.2 Verificar que TopBar é ocultada ou adaptada corretamente no modo inventory (sem contador de jogos)

## 12. Backup e Restauração do Inventário

- [x] 12.1 Adicionar categoria `inventoryImages` à lista de categorias de exportação no `dataPortabilityDao.ts` (ou equivalente), cobrindo tabelas `hardware_items`, `item_types`, `conservation_states`, `hardware_item_photos` e diretório `%APPDATA%/gamestock/inventario/images/`
- [x] 12.2 Implementar exportação da categoria `inventoryImages`: serializar rows SQLite + zipar arquivos de imagem de `inventario/images/` dentro do pacote
- [x] 12.3 Implementar importação da categoria `inventoryImages`: deszipar imagens para `inventario/images/{item_id}/` local, regravar `file_path` para caminhos de destino, inserir/atualizar itens por chave `name + platform.name`
- [x] 12.4 Atualizar `DataPortabilitySettings.tsx`: adicionar checkbox "Inventário (itens e fotos)" independente na lista de categorias de exportação/importação
- [x] 12.5 Atualizar preview de importação para exibir contagens de itens de inventário quando a categoria estiver presente no pacote

## 13. Validação e Ajustes Finais

- [ ] 13.1 Testar fluxo completo: criar item → ver card → abrir detalhe → editar → deletar
- [ ] 13.2 Testar galeria: adicionar múltiplas fotos → verificar nomes UUID únicos em disco → verificar foto de capa → remover foto
- [ ] 13.3 Testar tipos e estados customizados: criar novo tipo → usar em item
- [ ] 13.4 Testar filtros combinados: plataforma + tipo + busca
- [ ] 13.5 Testar alternância de sidebar: biblioteca → inventário → biblioteca; verificar que filtros de biblioteca são preservados
- [ ] 13.6 Testar backup: exportar apenas categoria Inventário → importar em banco limpo → verificar itens e imagens restaurados com caminhos corretos
