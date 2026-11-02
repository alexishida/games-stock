<!-- Evidências do inventário e de Configurações (tarefas 8.1 a 8.4). -->
# Inventário e Configurações no runtime nativo

Este documento registra a fronteira de serviços do inventário físico, a reconstrução das telas de
cards/lista/detalhe/formulário e a conclusão das seções de Configurações (`logs` e `sobre`). A
referência é a captura Electron `artifacts/native-migration/electron-reference-0uUvOQ/`
(`inventario.png`, `inventario-lista.png`, `inventario-detalhe.png`, `inventario-novo-item.png`,
`configuracoes-logs.png` e `configuracoes-sobre.png`).

## Serviços, DAOs e modelo (8.1)

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Serviço | `native/src/services/InventoryService.*` | Filtros (`platformId`, `itemTypeId`, `conservationStateId`, busca), ordenação, página, CRUD, tipos/estados, fotos, plataformas com itens e conversão de mídia. |
| DAOs | `native/src/db/dao/HardwareItemDao.*`, `HardwareItemTypeDao.*`, `HardwareConservationStateDao.*` e `HardwareItemPhotoDao.*` | Toda a SQL: JOINs, contagem total/filtrada, paginação, multiplataforma, reordenação transacional e catálogos auxiliares. |
| Modelo | `native/src/models/HardwareItemListModel.*` | Papéis tipados (`itemId`, `name`, `platformName`, `coverUrl`, `typeName`, `conservationName`, `color`, `storageLocation`, `value`, `acquisitionDate`, `isMultiplatform`). |
| Preferências | `native/src/services/InventoryPreferences.*` | `viewMode`, `search` e `sortBy` independentes da biblioteca (tarefa 5.4). |
| Mídia | `MediaReader` / provider `profilemedia` | Lê fotos somente dentro do perfil; caminhos externos são recusados. |

Regras preservadas do `hardware-inventory`:

- `Multiplataforma` é marcador interno (`platform_id = NULL`, `is_multiplatform = 1`) e nunca cria
  plataforma na biblioteca. Atualizar apenas `platform_id` conserva o marcador; desligá-lo grava a
  plataforma real.
- Filtros combinados usam `LIKE ... COLLATE NOCASE`; a ordenação `name`, `type` e `recent` acontece no
  SQLite para manter páginas estáveis, com 36 itens por página.
- Tipos e estados padrão vêm do seed (`is_default = 1`); valores criados pela UI usam
  `is_default = 0`. Nome duplicado retorna erro acionável. Excluir tipo/estado usa
  `ON DELETE SET NULL`, preservando o item.
- Fotos são copiadas para `<perfil>/inventario/images/<item_id>/<uuid>.<ext>` após validar extensão
  (`jpg`, `jpeg`, `png`, `webp`) e assinatura real do arquivo. A ordem é `sort_order`; a primeira é a
  capa. Excluir o item remove registros por CASCADE e o diretório gerenciado.
- Excluir mídia só toca arquivos sob `inventario/images`; um caminho legado externo tem o registro
  removido sem apagar o arquivo fora do perfil.

## Telas (8.2)

- `HardwareInventoryPage.qml` mantém busca de 34 px, ordenação, alternância cards/lista, contador
  `Exibindo N de M itens`, grade de 36 e paginação. A sidebar troca a árvore de plataformas pelos
  filtros de tipo/condição e mantém as ações no rodapé; a área contextual rola sozinha para não
  esconder “Novo item”/“Configurações” em 1024×768.
- `HardwareItemCard.qml` reproduz a capa 180×160, gradiente inferior, plataforma, nome, tipo e badge
  de condição com as mesmas cores semânticas (`Novo`, `Ótimo`, `Bom`, `Ruim`, reparo/defeito).
- `InventoryListLine.qml` usa a grade tabular do renderer, ocultando cor/valor/aquisição abaixo de
  900 px lógicos, como o CSS abaixo de 1180 px.
- `HardwareItemDetailPage.qml` traz hero com brilho, capa 320×200, chips em caixa alta, título,
  ações, resumo de quatro colunas, grupos de dados, galeria, lightbox e navegação entre itens. Abaixo
  de 1100 px lógicos os painéis empilham, como a media query de referência.
- `HardwareItemFormDialog.qml` cobre criação/edição, plataforma/Multiplataforma, seletores com
  criação inline, descrição, fotos (adicionar, remover, subir/descer e selo “Capa”), detalhes
  adicionais e validação de nome/plataforma/tipo/condição. A confirmação de exclusão reutiliza
  `ConfirmDialog`.
- Seletores nativos de arquivo continuam sendo `FileDialog` do Qt; o QML não recebe um caminho
  arbitrário do processo principal.

## Configurações: logs e Sobre (8.3)

`native/src/services/SettingsService.*` alimenta as duas seções restantes:

| Recurso | Comportamento |
|---|---|
| Logs | Lê o arquivo `native-prototype.log` do perfil, aceita até 500 entradas, mostra data, nível, origem e mensagem; atualizar, limpar e abrir a pasta são ações do serviço. |
| Estatísticas | Jogos da biblioteca, itens do inventário, tamanho do perfil e caminho de dados; a varredura é síncrona e cacheada por 30 s. |
| Manutenção | Abre a pasta de dados e limpa apenas o cache temporário de ROMs extraídas, com feedback textual. |
| Sobre | Versão/build, descrição, autoria, estatísticas e ações de manutenção, fiéis aos tokens do modal. |

As seções `plataformas`, `emuladores`, `biblioteca`, `covers` e `partidas` já vinham das tarefas
anteriores. `backup` continua aguardando a tarefa 9.4 e a atualização manual/ponte de transição
pertence à 10.3; por isso a seção `backup` permanece desabilitada na navegação e o botão de
atualização não foi antecipado.

## Estado compartilhado e jobs (8.4)

- `JobManager` é a fonte única de progresso e vive no `main.cpp`, acima de qualquer tela. Trocar de
  seção, abrir Configurações ou alternar Biblioteca/Inventário não recria o registro; a
  `NotificationCenter` continua lendo o mesmo modelo.
- A tela de inventário consome apenas `InventoryService`, `InventoryPreferences` e
  `PlatformService.items`; a biblioteca persiste suas preferências em `app_state` e o inventário
  mantém as suas em memória, sem interferência.
- O teste QML `HardwareInventory.test_08_jobsSurviveNavigation` mantém um job interrompido visível
  enquanto percorre `plataformas → logs → sobre → emuladores` e alterna Biblioteca/Inventário; a
  contagem e o progresso permanecem iguais.

## Evidências executadas (Windows, 02/11/2026)

```powershell
cmake --preset windows-msvc -S native
cmake --build native/build/windows-msvc --config Release --parallel 4
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
matriz congelada em `parity.md` (gerador em `tools/legacy-runtime/scripts/`)
matriz congelada em `parity.md` (gerador em `tools/legacy-runtime/scripts/`) --check
```

- CTest: **25/25 aprovados**, incluindo `hardware-inventory` (multiplataforma, filtros, ordenação,
  paginação, fotos, exclusão em cascata e catálogos) e `settings-service` (logs, estatísticas e cache
  de ROMs).
- QML: **6 arquivos e 45 testes aprovados**. `tst_HardwareInventory.qml` cobre sidebar/modos, busca
  com debounce, ordenação, cards/lista, detalhe, criação, exclusão, Logs/Sobre e navegação com job
  ativo. `tst_LibrarySearch.qml` foi ajustado para arrastar o modal pela área de fundo, não pelo
  conteúdo rolável.
- `native-parity` gera e verifica a matriz; `hardwareInventory` e `view` estão marcados como
  implementados nesta etapa.

Capturas reproduzíveis (perfil derivado de `electron-reference-0uUvOQ`, com tipos/estado e foto
copiada para dentro do perfil):

```powershell
$p = (Resolve-Path "artifacts/native-migration/qt-inventory-windows/profile").Path
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --open-inventory --capture artifacts/native-migration/qt-inventory-windows/inventario-grade.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --inventory-list --capture artifacts/native-migration/qt-inventory-windows/inventario-lista.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --open-inventory-detail --capture artifacts/native-migration/qt-inventory-windows/inventario-detalhe.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --open-inventory-form --capture artifacts/native-migration/qt-inventory-windows/inventario-formulario.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --open-logs --capture artifacts/native-migration/qt-inventory-windows/configuracoes-logs.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $p --fixture-db "$p/gamestock.db" --media-dir $p --open-settings --capture artifacts/native-migration/qt-inventory-windows/configuracoes-sobre.png
```

Comparação na fixture de 1024×768 (área útil 1008×729, escala 100%):

- Grade: cards de 180×192 iniciando 20 px após a sidebar, contador e botões de ordenação/visualização
  coincidem com `inventario.png`; a captura Electron mostra contagens de sidebar zeradas enquanto o
  topo exibe 2 itens, inconsistência que o runtime nativo não reproduz (usa a mesma consulta).
- Lista: colunas e miniatura seguem `inventario-lista.png`; abaixo de 900 px as colunas de cor/valor/
  aquisição são ocultadas como no CSS.
- Detalhe: hero, chips em caixa alta, ações, resumo e empilhamento dos painéis abaixo de 1100 px
  seguem `inventario-detalhe.png`. A foto sintética só carrega quando copiada para dentro do perfil,
  pois o provider recusa caminhos externos.
- Formulário: `inventario-novo-item.png` mantém duas colunas, campos obrigatórios primeiro,
  descrição em altura fixa, seletor com criação inline e “Mostrar detalhes adicionais”. A altura da
  descrição é 150 px contra 180 px da referência; a diferença é visual e não altera o fluxo.
- Logs e Sobre: estrutura, ações e estatísticas seguem `configuracoes-logs.png` e
  `configuracoes-sobre.png`; “Buscar atualização” fica para a tarefa 10.3.

## Limitações registradas

- A seleção de fotos usa o `FileDialog` nativo; o teste QML não abre o seletor do sistema. A
  validação de extensão/assinatura, cópia, exclusão e reordenação é comprovada no teste C++
  `hardware-inventory`.
- A varredura de tamanho do perfil é síncrona e cacheada por 30 s; perfis muito grandes podem
  apresentar uma pausa breve ao abrir Sobre. Mover para worker fica para uma otimização posterior.
- O painel de galeria no detalhe aparece abaixo dos dados em larguras menores, como no Electron;
  a captura em 1008 px não mostra a galeria na primeira dobra.
- Backup (`inventoryImages`), atualização manual e ponte de distribuição continuam nas tarefas 9.x e
  10.x; não foram simulados como concluídos nesta etapa.

