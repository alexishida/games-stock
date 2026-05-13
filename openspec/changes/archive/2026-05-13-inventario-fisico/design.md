## Context

O GameStock já possui padrões sólidos de CRUD (games, emulators, platforms) com arquitetura IPC bem definida: canais em `ipc-channels.ts`, handlers no `main`, exposição via `contextBridge` no preload, DAOs em `src/main/db/dao/` e componentes React no renderer. O módulo de inventário físico de hardware segue exatamente esses padrões sem introduzir novas camadas ou dependências.

A sidebar atual (`library-ui`) exibe árvore de plataformas fixamente. O módulo de inventário precisa de uma sidebar contextual diferente (filtros por tipo, condição, plataforma de hardware) sem quebrar o comportamento atual da biblioteca.

## Goals / Non-Goals

**Goals:**
- CRUD completo de itens de hardware com campos obrigatórios e opcionais
- Tipos de item e estados de conservação gerenciáveis pelo usuário (com defaults pré-cadastrados)
- Galeria de fotos por item (múltiplas imagens locais)
- Visualização em cards com busca e filtros
- Sidebar contextual para o módulo de inventário
- Campos sugeridos além dos solicitados: `serial_number`, `region`, `storage_location`, `loan_to`

**Non-Goals:**
- Integração com LaunchBox ou fontes externas de metadados de hardware
- Inventário de jogos físicos (já coberto por `physical-inventory` spec existente)

## Decisions

### D1: Tipos e estados em tabelas SQLite, não enums hardcoded

**Decisão:** `item_types` e `conservation_states` como tabelas com `is_default` flag. Defaults inseridos via seed na migration.

**Alternativa descartada:** Enum fixo em TypeScript. Impede o usuário de cadastrar tipos próprios (ex: "Fita de Master System", "Controle Arcade").

**Defaults sugeridos:**
- Tipos: Console, Controle, Cabo de Energia, Cabo de Vídeo, Cartucho/Mídia, Memória/Memory Card, Acessório, Outros
- Condição: Novo, Ótimo, Bom, Ruim, Necessita Reparo

### D2: Fotos em tabela separada `hardware_item_photos`

**Decisão:** Tabela com `item_id`, `file_path`, `sort_order`. Arquivos copiados para `%APPDATA%/gamestock/inventario/images/{item_id}/`.

Nome do arquivo gerado com UUID v4 preservando extensão original (ex: `a3f7c2d1-...-.jpg`), garantindo unicidade mesmo com múltiplos uploads do mesmo arquivo fonte.

**Alternativa descartada:** Coluna JSON no item. Dificulta reordenação, deleção individual e integridade referencial.

**Cópia de arquivo:** Ao adicionar foto, gerar UUID, copiar para `%APPDATA%/gamestock/inventario/images/{item_id}/{uuid}.{ext}` via handler IPC no main. `file_path` no banco armazena o caminho absoluto gerado. Ao deletar item, remover subdiretório `{item_id}/` inteiro.

### D7: Fotos de inventário incluídas no backup

**Decisão:** Fotos do inventário (`%APPDATA%/gamestock/inventario/images/`) são exportadas como nova categoria `inventoryImages` no pacote `.gamestock-backup`. A seção "Geral" do SettingsModal exibe a categoria separada das demais (`metadata`, `images`, `platforms`, `romLocations`).

Na importação, caminhos de imagem são regravados para o diretório de dados da máquina de destino (mesmo padrão das imagens de jogos). O matching de itens na importação usa `hardware_items.name + platform.name` como chave estável, sem depender de IDs SQLite do pacote.

**Alternativa descartada:** Não incluir fotos no backup. Perderia dados relevantes do colecionador em migração de máquina.

### D3: Sidebar com modo de navegação via Zustand

**Decisão:** Adicionar `sidebarMode: 'library' | 'inventory'` ao store Zustand. Sidebar renderiza conteúdo diferente por modo. Botões "Biblioteca" e "Configurar" sempre visíveis na parte inferior da sidebar.

**Alternativa descartada:** Rota separada / BrowserWindow nova. Viola regra do projeto (modais React; janelas apenas para fluxos completamente independentes).

### D4: Cards de inventário reutilizam padrão visual da GameGrid

**Decisão:** `HardwareItemCard` segue o mesmo layout de card da biblioteca (imagem, título, badge de plataforma). Adapta campo inferior para exibir tipo + condição em vez de publisher/ano.

### D5: Foto principal = primeiro item na ordem de `sort_order`

**Decisão:** A foto com menor `sort_order` é usada como capa do card. Se nenhuma foto, exibe placeholder com ícone de hardware.

### D6: IPC namespace `hardwareInventory`

**Decisão:** Novo namespace em `ipc-channels.ts` com canais para CRUD de items, types, states e photos. Segue padrão de nomenclatura `domain:action` existente.

## Risks / Trade-offs

- **Crescimento do banco de imagens** → Sem limpeza automática de fotos órfãs. Mitigação: ao deletar item, deletar diretório de fotos no handler IPC.
- **Sidebar contextual quebra estado de filtro da biblioteca** → Mitigação: `sidebarMode` troca a view, mas filtros da biblioteca (plataforma selecionada, busca) ficam preservados no store ao voltar.
- **Muitos campos opcionais no formulário** → UX pode ficar pesada. Mitigação: agrupar campos opcionais em seção expansível "Detalhes adicionais" no form.

## Migration Plan

1. Adicionar migration em `src/main/db/database.ts` criando as 4 tabelas e inserindo os seeds de defaults.
2. Migration é idempotente (verifica `IF NOT EXISTS`).
3. Rollback: não aplicável (app desktop, sem prod migration pipeline). Em dev, basta deletar o `.db`.

## Open Questions

- Reordenação de fotos: drag-and-drop na galeria ou apenas botões de sobe/desce? → Assumir botões por simplicidade; drag pode vir depois.
- Campos `serial_number` e `loan_to`: visíveis no card ou só no detalhe? → Só no detalhe para não poluir o card.
