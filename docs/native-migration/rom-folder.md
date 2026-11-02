<!-- Evidência da tarefa 7.5: scan e importação de ROMs no runtime nativo. -->
# Scan e importação de pastas de ROM

## Escopo entregue

- `src/app/RomFolderScanner.*`: porta de `scanRomFolder` de `src/main/romFolderImport.ts`.
- `src/services/RomFolderService.*`: fachada tipada usada pelo QML/jobs, sem SQL na UI.
- `src/db/dao/RomFolderDao.*`: contagem, listagem e remoção de registros por pasta.
- `PlatformDao::listPrimaryExtensions` e `GameWriteDao::findIdByRomPath`: consultas de apoio.
- `tests/RomFolderTest.cpp` e CTest `rom-folder`.

## Scan

O scan nunca escreve no banco nem abre o conteúdo das ROMs. Ele apenas lista arquivos e
classifica cada item em candidato ou ignorado.

- **Manual**: exige `platformId` válido. As extensões permitidas são as primárias da
  plataforma; se a plataforma não tiver nenhuma, usa o catálogo completo como no Electron.
- **Automático**: usado quando `detectionMode == "automatic"` ou quando não há plataforma.
  A plataforma é inferida pela extensão primária cadastrada.
- **Genéricas**: `.zip`, `.7z`, `.iso`, `.bin`, `.cue`, `.chd` e similares nunca entram na
  detecção automática, mesmo sendo extensão primária de alguma plataforma.
- **Ambíguas**: extensão primária de mais de uma plataforma é ignorada com a lista de
  plataformas conflitantes no motivo.
- **Subpastas**: `includeSubfolders` controla a recursão; cada candidato guarda a pasta
  imediata do arquivo, como no renderer legado.
- **Título candidato**: `normalizeRomTitle` remove extensão, separadores, tags de região e
  revisão, produzindo o mesmo texto usado no matching.

O resultado expõe `folderPaths`, `romFilePaths`, `platformId` (`null` no modo automático),
`platformName`, `detectionMode`, `includeSubfolders`, `candidates`, `detectedPlatforms`,
`ignored` e `ignoredItems`.

## Importação

Nesta tarefa cada candidato vira um placeholder persistido com `title`, `platform_id` e
`rom_path`. A consulta LaunchBox e o download de mídia continuam na tarefa 7.6.

- O upsert procura a ROM por `rom_path` e `platform_id`; reimportar a mesma pasta atualiza
  os registros em vez de duplicá-los.
- ROMs com o mesmo título normalizado (por exemplo, regiões diferentes) mantêm registros e
  caminhos distintos, mas compartilham a chave de agrupamento e aparecem como variantes no
  seletor da biblioteca.
- Falha em um candidato não aborta o lote: o item recebe `status: "failed"` com `error`.
- O resumo mantém o contrato legado: `created`, `updated`, `skipped`, `unmatched`,
  `failedDownloads` e `processed`.
- `includeSubfolders` é ecoado no resultado para a UI confirmar o mesmo escopo do scan.
- O sinal `progress` emite `current`, `total`, `folderPath`, `filename`, `stage` e `message`
  nos estágios `preparing_metadata`, `matching`, `saving`, `done` e `error`.

Arquivos físicos nunca são abertos, movidos ou apagados pela importação.

## Remoção de registros por pasta

`removeFolderRecords(folderPath, platformId)` remove somente linhas de `games` cujo
`rom_path` está dentro da pasta, inclusive subpastas. As regras são:

- caminhos são normalizados (absolutos, separador `/`, minúsculos no Windows) antes da
  comparação por prefixo;
- `platformId` zero remove todas as plataformas; um ID remove apenas aquela plataforma;
- a exclusão roda em transação e retorna a quantidade removida;
- `countFolderRecords` usa a mesma regra para a tabela de resumo;
- nenhum arquivo do sistema de arquivos é tocado.

## Evidência automatizada

`rom-folder` cobre:

1. modo manual com filtro de extensão, pasta inexistente e subpastas ligadas/desligadas;
2. modo automático com extensão genérica, desconhecida e ambígua;
3. criação de placeholders, agrupamento de variantes, reimportação idempotente e
   preservação dos arquivos;
4. remoção com e sem filtro de plataforma, incluindo subpastas e registros de outra pasta;
5. normalização de títulos com região, revisão e tags.

Resultado local (Windows/MSVC): **7 passed, 0 failed**.

## Pendente para a tarefa 7.6

- Matching LaunchBox, download de capas/mídias e revisão de candidatos na UI.
- Perfis TeknoParrot (`UserProfiles`) no scan manual.
- Job em background, notificações persistentes, retomada e dispensa.
- Sincronização incremental de mídia e telas do importador.
