<!-- Evidências da portabilidade completa (tarefas 9.2 a 9.5). -->
# Portabilidade de dados: exportação, importação e recuperação

Este documento completa a base ZIP64/manifesto da tarefa 9.1 com as cinco categorias, matching,
staging/rollback, UI e compatibilidade cruzada com o Electron.

## Serviços e matching (9.2)

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| DAO | `native/src/db/dao/PortabilityDao.*` | Exporta/importa jogos, mídias, plataformas, aliases, extensões, emuladores, vínculos, localizações de ROM e inventário. |
| Serviço | `native/src/services/BackupService.*` | Monta o ZIP, valida manifesto/dados, calcula conflitos, executa importação transacional e staging de mídias. |
| Coordenador | `native/src/services/BackupCoordinator.*` | Pré-visualiza na thread da UI e agenda exportação/importação no `JobManager`. |
| Jobs | `native/src/jobs/JobRegistry` / `JobManager` | Progresso, conclusão/falha e persistência em `gamestock.dataPortability.jobs`. |
| UI | `native/qml/components/DataPortabilitySettings.qml` | Categorias, estatísticas, preview, avisos/erros, botões e estado bloqueado. |

### Categorias

- `metadata`: `data/games.json` com título, plataforma por **nome**, categoria, publisher, ano,
  gênero, rating, favorito, status, notas, `launchbox_id` e `romFileName` (sem caminho absoluto).
- `platforms`: `data/platforms.json`, `data/platformMappings.json` (aliases/extensões) e
  `data/emulators.json` (emuladores/vínculos).
- `images`: arquivos `media/<relativo>`, `data/mediaMap.json` e atualização de
  `box_art_path`/`background_path`/`screenshot_path`.
- `romLocations`: `data/romLocations.json` com caminhos de ROM (arquivos não são embutidos) e
  entradas de pasta com `includeSubfolders`.
- `inventoryImages`: `data/inventory.json` mais fotos em `inventory-media/<relativo>`, abrangendo
  tipos, estados, itens, marcador Multiplataforma, fotos e ordem.

### Matching de importação

1. `launchbox_id + plataforma` quando presente.
2. Nome do arquivo ROM (`romFileName`) dentro da plataforma; título exato ou único candidato.
3. Placeholder sem `rom_path` com o mesmo título (restauração de variantes na ordem metadados→ROMs).
4. Fallback por título apenas quando há um único candidato inequívoco.

Plataformas usam nome normalizado (minúsculas, sem acentos, espaços simples); extensões sempre levam
ponto; emuladores existentes preservam o executável local quando o backup traz um caminho da máquina
de origem. Aliases/extensões só são substituídos para plataformas presentes no pacote. O preview
calcula criação/atualização de jogos, plataformas e emuladores sem alterar o banco.

## Staging e rollback (9.3)

- Todo arquivo de `media/`/`inventory-media/` é extraído primeiro para
  `<perfil>/.backup-staging/<uuid>/`.
- O SQLite roda em uma transação; os caminhos finais são calculados, mas os arquivos só são movidos
  depois que todas as categorias foram importadas.
- Antes de sobrescrever um arquivo existente, ele é movido para
  `<staging>/backup/<n>-<nome>`; em falha de move/commit, os arquivos novos são removidos e os
  originais são restaurados.
- `ZipReader::extractPrefix` rejeita `..`, caminhos absolutos, unidades Windows e entradas que não
  sejam arquivos regulares; links simbólicos não são materializados.
- Falha de disco é testada bloqueando o diretório `images` com um arquivo: a transação reverte, o
  diretório bloqueador permanece e nenhum jogo é gravado.
- O hook `GAMESTOCK_BACKUP_TEST_FAIL_AFTER_STAGE=1` simula falha após o staging para comprovar
  restauração do arquivo preexistente e do banco.

## Jobs e UI (9.4)

- Exportação/importação rodam em `JobWorker` com `BackupService` próprio, sem compartilhar a conexão
  SQLite da UI.
- `BackupCoordinator` publica o job `data-portability-export/import`; o `NotificationCenter` mostra
  etapa, barra e status final. Progresso não grava SQLite a cada tick.
- O `JobRegistry` persiste início/fim/falha e o `main.cpp` restaura
  `gamestock.dataPortability.jobs`; `running` vira `interrupted` na reabertura.
- A aba Backup bloqueia exportação/importação sem categoria, desabilita categorias ausentes no
  pacote, exibe até 8 avisos/erros e impede importar com erros críticos.
- A UI mantém a estrutura do renderer: cartões de estatísticas, grade de categorias, painéis de
  exportação/importação e botões à direita.

## Compatibilidade e recuperação (9.5)

### Electron → Qt

`native/tests/fixtures/complete.gamestock-backup` (gerado pelo Electron) é lido, pré-visualizado e
importado pelo teste `backup-service`: 3 metadados resultam em 2 jogos (as duas variantes de mesmo
título/arquivo são reconciliadas como no próprio Electron), 2 itens e 1 foto de inventário; reimportar
não duplica entidades.

### Qt → Electron

Fluxo automatizado:

```powershell
$env:GAMESTOCK_BACKUP_EXPORT_OUT = "$PWD/artifacts/native-migration/qt-export-compat.gamestock-backup"
native/build/windows-msvc/Release/backup_service_tests.exe exportAndRoundTripAllCategories
node scripts/native-backup-compat.cjs artifacts/native-migration/qt-export-compat.gamestock-backup
```

Resultado registrado em `artifacts/native-migration/backup-compat-result.json`: preview aprovado,
job `completed`, **1 jogo, 1 item, 1 foto**, capa restaurada e `mediaExists: true`. O escritor
`CompatibleZipWriter` grava CRC/tamanhos no cabeçalho local (STORED), sem data descriptors, que é o
formato aceito pelo leitor legado.

### Restauração em perfil vazio/populado

- Perfil vazio (schema/seeds): todas as categorias restauram jogos, plataformas, emuladores,
  vínculos, mídias, ROMs e inventário.
- Perfil populado: reimportação atualiza registros existentes, não duplica jogos/itens/fotos e
  preserva mídias locais em caso de falha.
- Falha de pacote corrompido é recusada antes de qualquer escrita; falha de I/O após staging reverte
  banco e arquivos.

## Evidências executadas (Windows, 02/11/2026)

```powershell
cmake --build native/build/windows-msvc --config Release --parallel 4
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
node scripts/native-backup-compat.cjs artifacts/native-migration/qt-export-compat.gamestock-backup
```

- CTest: **28/28 aprovados**, incluindo `portable-archive`, `backup-service` e
  `backup-coordinator`.
- QML: **6 arquivos, 46 testes aprovados**; `HardwareInventory.test_09_backupPanel` cobre seleção
  vazia bloqueada, preview, avisos/erros e envio de categorias.
- Captura `configuracoes-backup.png` compara com `electron-reference-0uUvOQ/configuracoes-backup.png`.

## Limitações registradas

- Cancelamento de um job em andamento é cooperativo e não interrompe a cópia corrente; ao reiniciar,
  o job `running` vira `interrupted` e pode ser reiniciado manualmente.
- Não há journal de arquivos para queda abrupta entre o move e o commit: o SQLite reverte, mas uma
  mídia recém-movida pode permanecer. O backup anterior continua válido para restauração explícita.
- O preview de pacotes grandes lê o diretório central e os JSONs na thread da UI; o limite é 64 MiB
  por JSON. Mídias são sempre extraídas em streaming.
- Linux continua adiado; toda esta evidência é Windows/MSVC.
