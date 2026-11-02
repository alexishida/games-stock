<!-- Evidências do registro compartilhado de jobs e workers (tarefa 7.1). -->
# Jobs e workers compartilhados

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `native/src/jobs/JobRegistry.*` | Retrato ordenado de jobs, transições persistidas e `updateProgress` em memória. |
| `native/src/jobs/JobWorker.*` | Trabalho cancelável executado em `QThread`, com sinais de progresso/conclusão/falha. |
| `native/src/jobs/JobManager.*` | Cria threads, conecta sinais enfileirados, aplica transições terminais e faz encerramento seguro. |
| `native/src/models/JobListModel.*` | Papéis `jobId`, `kind`, `status`, título, progresso, indeterminado e erro para QML. |

## Contrato

- O `JobRegistry` e o `JobManager` pertencem à thread da UI; `JobWorker::run` executa em thread
  própria. Todos os sinais worker → manager usam `Qt::QueuedConnection`.
- Progresso (`reportProgress`) atualiza apenas memória e emite `changed`; SQLite só é escrito no
  início (`start`), conclusão/falha (`finish`) e dispensa (`dismiss`).
- `start` persiste o estado `running` antes de iniciar a thread. Falha de persistência não cria
  worker.
- `finish` aceita apenas `completed`/`failed`; `dismiss` recusa jobs em execução.
- Cancelamento é cooperativo: o trabalho consulta `isCancelled()` e retorna. `cancel` altera um
  `std::atomic`, sem depender do event loop da thread ocupada.
- `shutdown(timeoutMs)` cancela todos, encerra as threads e entrega sinais pendentes. Se algum
  trabalho ignorar o cancelamento além do timeout, retorna falso e mantém `running`; na próxima
  abertura `restore` converte em `interrupted`.
- O destrutor aguarda as threads cooperativas antes de liberar o registro; nenhum callback usa
  objetos já destruídos.

## Evidências

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release -R "job-manager|job-registry" --output-on-failure
```

`job-manager` cobre:

- timer/heartbeat na thread da UI enquanto o worker publica progresso;
- status `completed`, progresso final e `activeCount` zerado;
- escrita apenas no início e na conclusão (`writes == 2`), nunca por tick;
- cancelamento cooperativo com `shutdown`, status `failed` e mensagem "Interrompido";
- timeout de fechamento sem destruir `QThread` em execução e segunda espera concluindo;
- dispensa de job terminal.

`job-registry` continua cobrindo restauração `running → interrupted`, falha de persistência,
rollback de transição e histórico de portabilidade limitado a cinco.

## Integração atual

- `RomFolderService` executa scan/importação em worker e usa `JobStateStore` na chave
  `gamestock.media.lastRomImportJob` (um job).
- `MediaSyncService` usa `gamestock.media.lastMediaSyncJobs` (lista curta).
- `MetadataService` mantém jobs de cache/busca/importação apenas em memória, sem ocupar as
  chaves legadas; o resultado volta por `JobManager::jobFinished`.
- `NotificationCenter.qml` lê o `JobListModel`, mostra progresso/resumo, retoma job de ROM
  interrompido e persiste a dispensa.
- `JobWorker::setResult` anexa o resultado serializado ao job terminal; o mesmo retrato é
  restaurado na abertura seguinte.

## Cache e diagnóstico

| Recurso | Local/formato |
|---|---|
| Metadata.xml, índice e `metadata.json` | diretório do perfil (`LaunchBoxCache`) |
| Capas, screenshots e fundos | `<perfil>/images/<plataforma>/<título>-<id>/` |
| Job de ROM | `app_state.gamestock.media.lastRomImportJob` (objeto) |
| Jobs de mídia | `app_state.gamestock.media.lastMediaSyncJobs` (array) |
| Log do protótipo | `<perfil>/native-prototype.log` |
| Progresso | `current`, `total`, `stage`, `message`, `filename`, `imageFilename`, `indeterminate` |

Diagnóstico rápido:

1. Consulte o card do NotificationCenter e o log do perfil; erros por jogo não abortam o lote.
2. Para cache corrompido, remova `Metadata.xml`/índice do perfil e repita a busca ou a
   sincronização; o download é idempotente.
3. Feche o app durante um job: na reabertura o status vira `interrupted` e o card oferece
   **Continuar** com os parâmetros persistidos.
4. Para validar sem rede, use os testes `launchbox-cache`, `metadata-search`, `metadata-service`
   e `media-sync`, que apontam para `HttpTestServer` e `GAMESTOCK_7Z_PATH`.

## Lote grande

`RomFolderTest::largeBatchKeepsUiResponsiveAndPersistsOnlyTransitions` cria 1.200 ROMs e inicia
o job real:

- um `QTimer` de 1 ms continua disparando na thread da UI durante o lote;
- o callback de persistência é chamado exatamente **2 vezes** (início e conclusão), não por
  tick de progresso;
- ao final, `progress.total == 1200`, `activeCount == 0` e todos os registros estão no banco.

Resultado local: `rom-folder` com **10 passed**, CTest completo **23/23** e QML **35/35**.

