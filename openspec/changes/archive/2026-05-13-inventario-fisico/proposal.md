## Why

O GameStock já rastreia jogos digitalmente, mas não oferece forma de catalogar o hardware físico da coleção (consoles, controles, cabos, acessórios). O colecionador precisa de um módulo dedicado para registrar, organizar e consultar os itens físicos que possui, com dados de condição, valor e fotos.

## What Changes

- Novo módulo de Inventário com seção própria na sidebar
- CRUD completo de itens físicos com campos obrigatórios e opcionais
- Tipos de item e estados de conservação configuráveis pelo usuário (com sugestões padrão)
- Galeria de fotos por item (upload de imagens locais)
- Visualização em cards similar à biblioteca de jogos
- Busca e filtros por plataforma, tipo de item e condição
- Sidebar contextual: ao navegar para Inventário, exibe apenas seções do inventário + botões Biblioteca e Configurar

## Capabilities

### New Capabilities

- `hardware-inventory`: Cadastro, listagem, busca e gerenciamento de itens físicos de hardware da coleção (consoles, controles, cabos, acessórios e outros). Inclui schema SQLite, DAOs, IPC, UI de cards, formulário de criação/edição com galeria de fotos e sidebar contextual para o módulo.

### Modified Capabilities

- `library-ui`: Sidebar passa a ter comportamento contextual — ao selecionar Inventário, exibe navegação interna do inventário (filtros por tipo/condição/plataforma) substituindo a árvore de plataformas da biblioteca, com botões fixos "Biblioteca" e "Configurar" sempre visíveis.

## Impact

- **Banco de dados**: novas tabelas `hardware_items`, `item_types`, `conservation_states`, `hardware_item_photos`
- **IPC**: novos canais em `src/shared/ipc-channels.ts` para o namespace `hardwareInventory`
- **Preload**: exposição de `window.gameStockAPI.hardwareInventory`
- **Renderer**: novo componente `HardwareInventory`, `HardwareItemCard`, `HardwareItemForm`, `HardwareItemDetail`; sidebar atualizada com modo contextual
- **Imagens**: fotos de itens salvas em diretório dedicado dentro do `userData` (similar a `box_art_path`)
- **Dependências**: sem nova dependência — reutiliza `adm-zip`, `better-sqlite3` e padrões existentes
