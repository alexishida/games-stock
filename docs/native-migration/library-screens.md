<!-- Evidências das telas e serviços da biblioteca (tarefas 5.1 a 5.5). -->
# Biblioteca nativa: serviços e telas

Este documento registra a fronteira tipada de jogos/plataformas e a reconstrução de detalhe,
formulário, exclusão, favorito/status e seletor de versões. A fonte de comparação é a captura
Electron `artifacts/native-migration/electron-reference-0uUvOQ/` (`jogo-detalhe.png`,
`jogo-edicao.png` e `jogo-versao.png`).

## Serviços e modelos (5.1)

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Serviço de jogos | `native/src/services/GameService.*` | `list`, `listGenres`, `get`, `create`, `update`, `remove`, `listMedia`, `listVersions`, `collectionCounts`, `sidebarCounts`, `launchStats`, `coverStats` e `resetLaunchStats`; filtros, página, gêneros e contadores observáveis. |
| Serviço de plataformas | `native/src/services/PlatformService.*` | `list`, `get`, `create`, `update`, `remove`, `getMappings` e `saveMappings`, com `gameCount` e bloqueios de exclusão. |
| DAOs | `native/src/db/dao/GameReadDao`, `GameWriteDao` e `PlatformDao` | Toda a SQL; QML não executa consultas nem comandos genéricos. |
| Modelos | `native/src/models/GameListModel` e `PlatformListModel` | Papéis tipados para cards/lista e para a árvore de plataformas. |
| Conexão | `native/src/db/WriteConnection` | Conexão de serviço por thread, `foreign_keys` e timeout; o bootstrap aplica schema/migrations antes. |

`GameService.update` expõe o nome `remove` para a operação lógica `delete`, porque `delete` é
palavra reservada em C++. `launch` e `syncCovers` usam `LaunchService` e `MediaSyncService`.

## Telas (5.2)

- `GameDetailPage.qml` substitui a grade na área principal quando há jogo selecionado, como o
  `GameDetail` Electron: ações no topo à direita, capa, chips de plataforma/ano/rating, título,
  publisher/gênero, favorito, concluído, jogando, editar e excluir.
- `GameFormDialog.qml` reconstrói o `GameForm`: card de título, hub de metadados, cards de ROM/mídia
  e rodapé. O editor manual empilhado (`GameMetadataEditor.qml`) altera título, publisher, gênero,
  ano, rating e descrição sem chamar o serviço até `Salvar`.
- `ConfirmDialog.qml` confirma a exclusão antes de chamar `GameService.remove`.
- `GameVersionDialog.qml` lista variantes com região, tipo, arquivo e histórico. A ação "Jogar"
  chama `LaunchService` para a variante escolhida; o detalhe usa o mesmo serviço quando há uma única
  versão.
- A sidebar, a busca, o gênero, a ordenação e "Exibir sem capa" passam por `GameService` quando o
  banco está aberto; a fixture continua atendendo às capturas do protótipo.

## Plataformas e sidebar (5.3)

- `PlatformManager.qml` lista nome, categoria, `gameCount`, com ações de vínculos, edição e remoção
  (oculta para padrão). O botão de criação fica no rodapé, como no Electron.
- `PlatformFormDialog.qml` cria/edita nome e categoria (`Console`, `Portatil`, `PC`); erro de nome
  vazio ou duplicado permanece no formulário.
- `PlatformMappingsDialog.qml` edita aliases e extensões em linhas adicionáveis/removíveis, com
  `is_primary` e validação do serviço antes da transação.
- `PlatformService` bloqueia exclusão de plataforma padrão, com jogos ou com itens de inventário.
- A sidebar consome `PlatformService.items` e `GameService.platformCounts`: mostra somente
  plataformas com jogos, agrupadas por categoria, atualiza contadores e filtra a biblioteca. "Todos"
  limpa apenas `platformId`, preservando busca/coleção/gênero.

## Preferências independentes (5.4)

- `LibraryFilterStore` (chave `gamestock.ui.libraryFilters`) persiste `selectedCategory`,
  `collectionFilter`, `showGamesWithoutCover`, `sortBy` e `viewMode`. `GameService` hidrata esses
  valores na abertura e regrava a cada alteração; `view-state` comprova o round-trip.
- `InventoryPreferences` mantém `viewMode`, `search` e `sortBy` do inventário em memória, como o
  store Electron, sem tocar no JSON da biblioteca. O teste `view-state` alterna os dois estados e
  confirma que um não altera o outro.
- Na interface, cards/lista da biblioteca usam `GameService.viewMode`; a tela de inventário consome
  `InventoryPreferences` sem interferência.

## Evidências executadas

```powershell
cmake --preset windows-msvc -S native
cmake --build native/build/windows-msvc --config Release --parallel 4
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
```

- CTest: **31/31** no corte, incluindo `game-service`, `platform-service`, `view-state`,
  `emulator-service`, `launch-service` e `libretro-media`.
- QML: **47/47**; `LibraryDetail` cobre detalhe, favorito/status, validação/persistência da edição,
  criação com plataforma obrigatória, confirmação de exclusão e seletor de versões.
- Capturas reproduzíveis (perfil da referência Electron, nunca o perfil real):

```powershell
$profile = Resolve-Path "artifacts/native-migration/electron-reference-kvJLgH/profile"
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $profile `
  --fixture-db "$profile/gamestock.db" --open-detail --capture artifacts/native-migration/qt-detail-page.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $profile `
  --fixture-db "$profile/gamestock.db" --open-platforms --capture artifacts/native-migration/qt-platforms.png
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $profile `
  --fixture-db "$profile/gamestock.db" --open-detail-edit --capture artifacts/native-migration/qt-game-form.png
```

`--open-detail` abre o primeiro jogo do catálogo; `--open-platforms` abre Configurações na seção de
plataformas; `--open-detail-edit` abre detalhe e formulário em camadas. Para conferir a preferência
persistida, execute uma vez com `--view-list`, feche e reabra sem a flag usando um perfil copiado: a
lista deve continuar ativa.

## Fronteira de serviços (5.5)

- QML conversa apenas com `GameService`, `PlatformService`, `LaunchService` e `InventoryPreferences`;
  nenhum arquivo QML contém SQL, `QSqlQuery`/`QSqlDatabase`, `QProcess` ou execução genérica.
- A matriz congelada em [parity.md](parity.md) registra a fronteira e os destinos de cada operação;
  o gerador histórico está em `tools/legacy-runtime/scripts/`.
- `GameListModel` e `PlatformListModel` entregam os papéis usados por cards, lista, detalhe e
  gerenciador; a paginação continua no serviço, sem materializar a biblioteca na interface.

## Limitações registradas

- Dois modais com `layer`/`MultiEffect` simultâneos podem deixar o painel superior levemente
  translúcido na captura empilhada. O conteúdo continua legível e a limitação está relacionada em
  [efeitos do protótipo](windows-effects.md).
- O botão "Jogar" usa o emulador padrão e o cache de ROMs; ausência de ROM, emulador, executável ou
  core aparece no detalhe sem iniciar processo.
