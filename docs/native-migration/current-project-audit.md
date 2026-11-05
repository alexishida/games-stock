<!-- Verificação atual de paridade, perfil existente e retirada definitiva do projeto Electron. -->
# Verificação do projeto nativo — 04/11/2026

Escopo: Windows 11, Qt 6.8.3, C++20/MSVC 2022. Design e layout aprovados preservados.
O inventário histórico contém 100 operações/listeners em 14 domínios. A revisão dos serviços,
DAOs e fluxos QML encontrou os equivalentes abaixo; listeners IPC viraram sinais/propriedades
observáveis e ações do menu antigo são acessíveis pela navegação nativa.

| Domínio | Operações históricas | Implementação e verificação |
|---|---:|---|
| Jogos | 16 | GameService, GameReadDao/GameWriteDao, LaunchService, MediaSyncService; CRUD, filtros, variantes, mídia, contagens, histórico e testes de biblioteca |
| Emuladores | 10 | EmulatorService e LaunchService; CRUD, vínculos em lote, padrão, RetroArch, extração e argumentos com emulador falso |
| Plataformas | 6 | PlatformService e DAOs; CRUD, aliases, extensões e contagens |
| Diálogos | 8 | Seletores Qt em formulários, ROMs, pastas, executáveis, imagens e backup; preservam o fluxo sem IPC genérico |
| Shell | 1 | Abertura controlada de caminhos pelo serviço nativo |
| Aplicativo | 6 | SettingsService e bootstrap; versão/build, perfil, estatísticas, limpeza de cache e logs |
| Atualização | 4 | UpdateService e splash; manifesto assinado, download, validação, continuação offline e atualização externa |
| Estado | 5 | DAOs de app_state, FolderStateStore e preferências tipadas; sem dependência de localStorage |
| Portabilidade | 6 | BackupService/BackupCoordinator e JobManager; cinco categorias, ZIP64, preview, progresso, rollback e idempotência |
| Metadados | 7 | MetadataService, LaunchBoxCache/Media, OpenVGDB e Libretro; busca, importação, mídia e jobs |
| Importação de ROMs | 9 | RomFolderService/Scanner e JobManager; scan, subpastas, revisão, sincronização, contagens, remoção e retomada |
| Visualização | 1 | Alternância nativa cards/lista com preferências independentes |
| Inventário | 18 | InventoryService e DAOs; itens, tipos, conservação, multiplataforma, fotos e ordenação |
| Navegação da biblioteca | 3 | Main.qml e gerenciadores; criar jogo, plataformas e ordenação |

## Perfil existente

Electron e C++ resolvem `%APPDATA%/gamestock` e respeitam `GAMESTOCK_USER_DATA_DIR`.
O banco `gamestock.db`, imagens e fotos mantêm seus caminhos. A versão nova não depende de
exportação/importação ou mudança de pasta. O aplicativo antigo deve estar fechado.

Foi criado um snapshot SQLite consistente em pasta de auditoria. Somente a cópia foi aberta pelo
aplicativo, usando o provider para ler as imagens do perfil original. Não foram copiados 39,6 GB
de imagens nem iniciados jobs de alteração sobre esses arquivos. SHA-256 do banco original
antes/depois coincidiu. Nenhum conteúdo pessoal ou captura dessa cópia foi adicionado ao Git.

| Dados | Antes | Após abertura/reabertura da cópia |
|---|---:|---:|
| Jogos, incluindo variantes | 6.012 | 6.012 |
| Plataformas | 34 | 34 |
| Emuladores | 8 | 8 |
| Vínculos plataforma/emulador | 14 | 14 |
| Aliases de plataforma | 81 | 81 |
| Extensões de ROM | 157 | 157 |
| Migrations aplicadas | 7 | 7 |
| Preferências existentes em app_state | 4 | 4 preservadas; uma chave de identidade do canal adicionada |

As 12 tabelas foram comparadas linha a linha, preservando todos os valores originais.
Integridade SQLite: `ok`; foreign keys: zero erros. Biblioteca, detalhe, emuladores e importador
abriram e geraram capturas com sucesso na cópia. As 5.104 capas, 3.923 fundos e 4.900 screenshots
cadastrados existem nos caminhos originais. Há **13 caminhos de ROM já indisponíveis** entre
6.012 registros; o aplicativo novo não pode recuperar arquivos ausentes e não alterou esses caminhos.
Totais visuais podem agrupar variantes e respeitam os filtros persistidos, por isso não precisam
coincidir com a quantidade bruta de linhas de games.

## Validações e limites

- Build Release completo e 31 executáveis CTest aprovados, incluindo importação do pacote Electron congelado.
- 54 testes QML aprovados; verificações visuais com dados existentes e fixtures isoladas.
- Teste adicional de migrations executado contra o banco populado reconstruído dos SQLs legados.
- Abertura das capas reais revelou ciclo entre tamanho implícito e fillMode; a orientação passou
  a usar sourceSize, preservando a composição das capas sem o aviso de binding loop.
- A inspeção direta do código Electron no Git revelou a falta do visualizador/download da galeria.
  O fluxo foi reposto com ampliação, navegação circular, exportação por diálogo e proteção da origem.
  Testes adicionais cobrem navegação/fechamento QML, cópia fiel, imagem externa recusada na exportação,
  conteúdo inválido, preservação de destino e importação de capa externa para dentro do perfil.
  A seleção de ROM agora usa QUrl::toLocalFile para preservar espaços e acentos.
- Uma corrida no teste de dispensa de job foi corrigida: ele aguarda o cleanup da thread, que ocorre
  após persistir o status terminal. O código de execução dos jobs foi preservado.
- Integrações de rede e lançamento são verificadas com respostas locais e emulador falso;
  esta auditoria não iniciou ROMs reais nem publicou/instalou atualização no computador do usuário.
- Linux, empacotamento Linux e validação em outros sistemas continuam adiados.

## Limpeza e estrutura

O backend congelado, ferramentas exclusivas do Electron, package.json/package-lock.json e
node_modules foram retirados após as verificações. A revisão automática bloqueou a exclusão
definitiva; o material foi preservado fora do workspace em
`D:/projetos/game-stock-retired-electron-2026-11-04`.
Um único artefato gerado, `artifacts/native-migration/electron-release/win-unpacked/resources/app.asar`,
permaneceu bloqueado por uma visualização no VS Code. Ele é ignorado pelo Git, não é projeto-fonte
nem dependência do aplicativo; sua retirada final depende de liberar esse arquivo no editor.
O histórico do Git e os relatórios continuam disponíveis; referências SQL e pacotes de backup
preservam a compatibilidade sem manter outro aplicativo executável.

O 7-Zip Windows, anteriormente obtido via npm, fica em native/third_party/7zip com checksum e
licenças. Fixtures usam somente Python stdlib; build, CTest, QML, deploy e instalador não precisam
de Node/Electron. Os scripts oficiais estão documentados em [scripts/README.md](../../scripts/README.md).

Instalador e ZIP portátil atualizados foram gerados em `release/windows/` e a pasta executável
em `release/windows-portable/`. O portátil abriu Configurações → Backup com perfil sintético
e PATH restrito a Windows, sem Qt/Node de desenvolvimento. Nenhuma instalação ou publicação
externa foi executada nesta auditoria.
