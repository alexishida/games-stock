<!-- Evidência da tarefa 7.6: importadores, jobs, mídia e NotificationCenter. -->
# Importadores, jobs e mídia

## Importador de pastas de ROM

`native/qml/components/RomFolderImporter.qml` ocupa a seção **Biblioteca** das Configurações e
expõe o histórico persistido pelo `FolderStateStore`:

- tabela com caminho, plataforma, quantidade indexada e indicador de subpastas;
- **Adicionar pasta** abre o assistente sobre o modal, com `FolderDialog`, seleção de
  plataforma (ou detecção automática) e opção de subpastas;
- a revisão mostra candidatos, itens ignorados e o motivo de cada extensão recusada antes de
  iniciar o job;
- **Continuar** reimporta uma pasta usando a plataforma salva;
- **Remover** apaga registros e a entrada persistida em transação, sem tocar nas ROMs.

Na detecção automática, uma entrada é salva para cada plataforma resolvida
(`detectedPlatforms`). A importação usa o mesmo `RomFolderService` da tarefa 7.5.

## Jobs em background

`JobManager`/`JobRegistry` são criados no bootstrap somente quando há banco explícito:

- o worker abre a própria `WriteConnection`; nenhum objeto de banco cruza threads;
- progresso é emitido por `JobWorker::reportProgress` e atualizado em memória, sem gravar
  SQLite a cada tick;
- início e transições terminais são persistidos; o resultado completo do job também;
- `JobRegistry::restore` converte `running` em `interrupted` sem perder os parâmetros;
- dispensar um job terminal remove a chave persistida, então ele não reaparece no próximo
  startup;
- `lastRomImportJob` aceita um único job de ROM, `lastMediaSyncJobs` mantém o histórico de
  mídia e jobs de metadados são efêmeros.

`RomFolderService::startImport` recusa um segundo lote simultâneo e remove terminais antigos
antes de iniciar outro. `JobManager::jobFinished` entrega o resultado ao `MetadataService`.

## NotificationCenter

`native/qml/components/NotificationCenter.qml` fica sobre a janela principal e lê o
`JobListModel`:

- título, arquivo/pasta atual, etapa, barra determinada ou indeterminada;
- resumo persistido (`criados`, `atualizados`) quando concluído e erro acionável em falha;
- dispensa grava a remoção no `app_state`;
- job de ROM interrompido oferece **Continuar**, reutilizando `folderPaths`, `romFilePaths`,
  `platformId`, `detectionMode` e `includeSubfolders`;
- o painel fica oculto quando não há jobs e não bloqueia a biblioteca.

## Mídia da biblioteca

`MediaSyncService` e `CoverSyncSettings.qml`:

- contadores de jogos, capas baixadas, ausentes e sincronizáveis;
- botão **Sincronizar mídia** inicia job `media-sync`; opção de baixar novamente capas e fundos;
- o worker garante `Metadata.xml`, reconstrói o índice e baixa `Box - Front`,
  `Screenshot - Gameplay` e, no modo completo, `Fanart - Background`;
- metadados textuais são atualizados; arquivos existentes são reaproveitados, salvo no modo
  completo;
- falhas por jogo entram no resumo sem abortar o lote;
- concluir o job atualiza contadores e recarrega a grade.

Limitação registrada: a sincronização usa o catálogo LaunchBox e ainda não repete o fallback
de imagens da Libretro do renderer Electron. `parity.md` mantém o domínio como **Parcial**
por esse motivo.

## Importador LaunchBox

`MetadataService` + `LaunchBoxImporter.qml`:

- botão **Metadados** na barra superior e no detalhe do jogo;
- busca por título com filtro de plataforma, executada em job com índice LaunchBox;
- seleção do resultado e dos cinco tipos de imagem;
- importação baixa a mídia e cria/atualiza por `launchbox_id` + plataforma;
- plataforma desconhecida é criada com categoria `Outros`, como no Electron;
- resultados e erros são observáveis no QML; a biblioteca é recarregada via sinal `imported`.

## Verificação

- CTest: **23/23** (`rom-folder`, `media-sync`, `metadata-service` incluídos).
- QML: **35/35**, incluindo `tst_RomFolderImporter.qml` com revisão/importação, resumo,
  remoção, retomada, dispensa e busca/importação LaunchBox.
- Capturas: seção Biblioteca com tabela persistida e seção Mídia da biblioteca com contadores.
- Testes de rede usam `HttpTestServer` e `GAMESTOCK_7Z_PATH`; nenhum perfil real é tocado.

## Pendências conhecidas

- Fallback Libretro na sincronização de capas.
- Perfis TeknoParrot no scan manual (herdado da tarefa 7.5).
- Matriz visual completa de todas as resoluções fica para a tarefa 11.1.
