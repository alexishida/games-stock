<!-- Comparação de release Electron/Qt na mesma máquina e massa (tarefa 11.2). -->
# Benchmark release Electron x Qt

## Responsividade do inventário (14/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. O teste usa somente bancos e imagens
temporários: 30.000 itens sintéticos e um PNG válido ampliado com bytes sintéticos para 48 MiB.
Resultados de uma execução, com cache de disco variável:

| Operação | Referência síncrona | Caminho assíncrono |
|---|---:|---:|
| Busca entre 30.000 itens | 8,565 ms bloqueando a chamada | 0,103 ms para iniciar; resultado observado em 51 ms |
| Cópia de foto de 48 MiB | 104 ms bloqueando a chamada | 0,121 ms para iniciar; conclusão observada em 152 ms |

O teste de foto registrou zero eventos do timer durante a cópia síncrona e 14 enquanto o job
assíncrono era aguardado. O tempo até o resultado inclui a espera periódica do Qt Test e não é
comparável diretamente ao tempo da chamada síncrona. O arquivo sintético e o cache podem não
representar fotos e discos reais; a melhoria medida é de responsividade, não necessariamente de
tempo total. Testes também cobrem filtros em sequência, cancelamento, erro, exclusão durante cópia,
cancelamento tardio, fechamento com job e leitura de perfil legado sintético. O cancelamento feito
após a gravação confirmada mantém o job como concluído.

Para repetir, compile `hardware_inventory_tests` em Release, inclua o `bin` do Qt no `PATH` e execute
`native/build/windows-msvc/Release/hardware_inventory_tests.exe inventoryResponsivenessMeasurement photoImportJobs -o resultado.txt,txt`.

## Capas da biblioteca (14/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Cada resultado usa cinco leituras de JPEGs
sintéticos com 3 milhões de pixels, em perfil temporário, e cache do sistema aquecido. Os bytes
representam a imagem decodificada, não a memória total da aplicação ou da GPU.

| Capa e escala | Integral: tempo / bytes | Reduzida: tempo / bytes | Erro médio por canal |
|---|---:|---:|---:|
| Horizontal, 100% | 86 ms / 12.000.000 | 10 ms / 89.440 | 0,573 em 255 |
| Horizontal, 200% | 78 ms / 12.000.000 | 17 ms / 359.840 | 0,370 em 255 |
| Vertical, 100% | 83 ms / 12.000.000 | 39 ms / 811.200 | 0,372 em 255 |
| Vertical, 200% | 81 ms / 12.000.000 | 66 ms / 3.244.800 | 0,174 em 255 |

O erro compara o mesmo encaixe para capa horizontal ou recorte central para capa vertical. Os testes
QML verificam a orientação e o modo de exibição; capturas com duas imagens sintéticas foram
inspecionadas nas duas escalas, em `native/build/library-covers-1.png` e `library-covers-2.png`.
A captura em 200% teve altura limitada pela tela. Para repetir a medição, execute o target
`data_paths_tests` em Release com o Qt no `PATH`, passando `libraryCoverDecodeMeasurement -o resultado.txt,txt`.
Essas amostras não representam todos os formatos, fotos ou o tempo total de carregamento da página.

## Miniaturas do inventário (14/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Foi usada uma imagem JPEG sintética de
3.200 × 2.400 pixels, em perfil temporário. Cada tempo corresponde a cinco leituras e
decodificações na mesma execução, com cache de sistema operacional aquecido. Os bytes são o
tamanho da imagem decodificada, não o pico de memória do processo nem da GPU.

| Escala | Imagem integral: 5 leituras / bytes | Miniatura: 5 leituras / bytes | Erro médio por canal no recorte |
|---|---:|---:|---:|
| 100% | 194 ms / 30.720.000 | 24 ms / 136.320 | 0,057 em 255 |
| 200% | 188 ms / 30.720.000 | 36 ms / 545.280 | 0,039 em 255 |

O erro compara o mesmo recorte central reduzido, usando imagem integral e miniatura decodificada;
não representa todas as fotos, formatos ou níveis de detalhe. Uma imagem panorâmica sintética foi
inspecionada no inventário nas duas escalas. O teste também cobre retratos, panoramas e limites de
resolução. A captura em 200% teve altura limitada pela tela disponível. Os artefatos locais ficam
em `native/build/inventory-thumbnail-1.png` e `native/build/inventory-thumbnail-2.png`.

Para repetir, compile o target `data_paths_tests` em Release, adicione o `bin` do Qt ao `PATH` e
execute `native/build/windows-msvc/Release/data_paths_tests.exe thumbnailDecodeMeasurement -o resultado.txt,txt`.
Os números são uma amostra de uma única máquina e não representam o tempo total da interface.

## Contagens e paginação da biblioteca (15/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Catálogo sintético em banco temporário,
com 50.000 jogos (duas variantes por grupo, um registro manual a cada quatro grupos, seis
plataformas, gêneros compostos, favoritos e datas). Nenhum perfil real é aberto; os tempos são
medianas de três leituras, com cache de disco variável. No caminho com cache, uma leitura
descartada preenche as contagens antes da medição.

| Cenário (50.000 jogos) | Sem cache | Com cache de contagens |
|---|---:|---:|
| Primeira página | 216,5 ms | 154,1 ms |
| Página 100 | 183,7 ms | 131,5 ms |
| Busca + favoritos | 63,0 ms | 8,7 ms |
| Gênero `Ação` + favoritos | 78,4 ms | 24,7 ms |
| Ordenação por mais jogados | 185,6 ms | 140,1 ms |
| Sem jogos sem capa | 165,9 ms | 69,5 ms |
| Contadores da sidebar | 149,9 ms | 0,002 ms |

Com 5.000 jogos, a mesma massa proporcional rendeu: primeira página 12,6 → 8,9 ms; página 100
15,4 → 12,8 ms; busca + favoritos 5,1 → 0,9 ms; gênero + favoritos 6,4 → 2,8 ms; sem capas
16,0 → 7,4 ms; sidebar 8,2 → 0,001 ms. A leitura da página continua dominando o custo: o cache
elimina as duas contagens distintas por consulta, mas não o agrupamento/ordenação dos
representantes.

O plano SQLite confirma a origem do custo. A contagem total executa `SCAN games` e
`USE TEMP B-TREE FOR count(DISTINCT)`; a contagem filtrada por favoritos troca o `SCAN` por
`SEARCH games USING INDEX idx_games_favorite`, mas mantém a árvore temporária. A sidebar faz
`SCAN games`, agrupa em árvore temporária e varre a subconsulta. A página usa
`SCAN games USING INDEX idx_games_platform` mais `USE TEMP B-TREE FOR ORDER BY` no ranking e
na ordenação final.

Três índices candidatos foram medidos no mesmo banco temporário, comparados ao controle sem
índice na mesma execução: `(platform_id, library_group_key, title)`,
`(favorite, platform_id, library_group_key)` e `(created_at DESC, id DESC, platform_id,
library_group_key)`. Os tempos ficaram entre 10% melhores e 20% piores, sem ganho consistente
entre as duas execuções, e nenhum remove a árvore temporária de agrupamento. Por isso o schema
não foi alterado; a paginação mantém a mesma seleção de representantes e a mesma ordenação.

A invalidação usa uma geração de dados incrementada na abertura e em `GameService::refresh()`
(CRUD, importação, sincronização e alterações disparadas pela UI). A chave reúne busca, gênero,
coleção, plataforma e o filtro de capas; página, ordenação e tamanho da página não invalidam.
Cada caminho (síncrono e worker somente leitura) mantém sua própria instância, sem compartilhar
estado entre threads. O teste `countCacheReuseAndInvalidation` cobre reutilização, mudança de
geração e invalidação da sidebar.

Para repetir, compile `native_benchmark` em Release e execute
`native\build\windows-msvc\Release\native_benchmark.exe --library 50000 [caminho-do-banco]`.
O caminho opcional preserva o banco para inspeção com `EXPLAIN QUERY PLAN`; sem ele, o banco é
temporário. Os números variam com o cache do sistema e não representam todas as bibliotecas.

## Busca LaunchBox (15/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Índice sintético com 50.000 jogos,
40 plataformas, um alias a cada dez jogos e uma entrada de mídia por jogo. Nenhum catálogo ou
perfil real é aberto. Os tempos são medianas de três buscas; a preparação é medida uma única vez.

| Operação (50.000 jogos) | Busca isolada | Visão preparada reutilizada |
|---|---:|---:|
| Busca ampla (`game 0000`, 100 resultados) | 236,4 ms | 3,7 ms |
| Plataforma restrita (`Platform 7`, 3 resultados) | 228,9 ms | 0,05 ms |

A preparação custou 227,8 ms e acrescentou 8,9 MiB ao working set (textos normalizados,
aliases e listas por plataforma; os objetos JSON continuam compartilhados). A primeira busca
da sessão paga esse custo; as seguintes o reaproveitam. Uma segunda execução repetiu os
valores: 250,1 → 4,0 ms na busca ampla e 235,9 → 0,05 ms na restrita, com 9,1 MiB.

A busca isolada é o caminho de uma chamada só (fallback de matching); ela também constrói a
visão preparada internamente para não duplicar a regra. O fluxo da tela de metadados guarda a
visão por versão do índice dentro do `LaunchBoxCache`, descartando-a quando o XML/índice muda.
Resultados exatos continuam antes dos parciais, aliases contam como nome, a ordenação por
título e o desempate pela posição original não mudaram; o limite é aplicado depois de ordenar
somente os primeiros candidatos.

Para repetir, compile `native_benchmark` em Release e execute
`native\build\windows-msvc\Release\native_benchmark.exe --launchbox 50000`. O teste
`preparedSearchMatchesDirect` compara a visão preparada com a busca direta em buscas amplas,
restritas, com aliases, limite, plataforma duplicada, consulta vazia e busca repetida.

## Downloads de mídia (15/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Foram usadas 12 imagens PNG sintéticas
de 20 × 20 px, servidas por HTTP local com 100 ms de latência por resposta. Nenhuma mídia ou
serviço real é acessado; os tempos incluem publicação atômica e geração do preview de capa.

| Fila | Execução 1 | Execução 2 |
|---|---:|---:|
| Sequencial (1 conexão) | 1.266 ms | 1.261 ms |
| Paralela (3 conexões) | 452 ms | 446 ms |

A fila paralela caiu para cerca de um terço do tempo, como esperado com três downloads
simultâneos. O teste `parallelDownloads` comprova no servidor que há 2 ou 3 conexões abertas
ao mesmo tempo (uma execução sequencial registraria 1) e que a ordem dos arquivos no resultado
continua a mesma do índice. `mediaDownloadMeasurement` produz os tempos acima.

O padrão é 3 conexões, limitado a 1–4 pelo parâmetro de `downloadImages`. Cada transferência
mantém timeout de inatividade de 30 s, limite de 20 MiB, temporário próprio com sufixo único e
publicação por `QSaveFile`; uma falha isolada não apaga a imagem anterior nem interrompe as
demais. Arquivos existentes continuam sendo pulados, `force` continua substituindo só quando o
download conclui, e o progresso avança de forma monotônica até o total. O teste local não
representa limites de taxa ou indisponibilidade do serviço real; por isso não foram usadas
mais de três conexões.

Para repetir, compile `launchbox_media_tests` em Release e execute
`native\build\windows-msvc\Release\launchbox_media_tests.exe mediaDownloadMeasurement -o resultado.txt,txt`
com o `bin` do Qt no `PATH`.

## Cards e efeitos visuais (15/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. Perfil temporário com 50.000 jogos
sintéticos, página de 36 cards e capturas em 1122 × 957 (100% e 200%). Nenhum perfil real é
aberto.

**Avaliação do `GridView`:** a grade é paginada em 36 cards. Trocar o `Repeater` por `GridView`
reduziria a criação apenas para os delegates visíveis, mas com foco por Tab os cards ainda não
criados deixariam de ser alcançáveis, a menos que `cacheBuffer` criasse a página inteira — o que
anula o ganho. A troca também alteraria a centralização das colunas, a altura de rolagem e a
navegação por teclado. Por isso o `Repeater` foi mantido e a redução de camadas foi feita dentro
do card, sem mudar a estrutura da grade.

**Camadas por card:** as camadas declaradas caíram de 5 para 3. A sombra saiu de uma camada que
continha o card inteiro para uma camada própria, apenas com o retângulo arredondado, e o
gradiente inferior passou a cobrir o card inteiro com o mesmo raio, dispensando a camada e a
máscara anteriores. A sonda de orientação, a máscara da capa e o `MultiEffect` de recorte foram
preservados.

As duas camadas removidas mediam 212 × 151 px cada (faixa de 58% de um card de 260 px). A
economia teórica de textura é de 250 KiB por card, ou seja, até **9 MiB** em 36 cards a 100% e
**35 MiB** a 200%. O working set do processo não isolou esse valor por causa do ruído de
inicialização: antes 216,1–216,5 MiB, depois 207,5–221,8 MiB. O primeiro quadro ficou em
2,32–2,45 s antes e 2,32–2,39 s depois (`qmlReadyMs` 2,26–2,45 s antes e 2,25–2,32 s depois);
a diferença está dentro da variação das execuções.

As capturas em `native/build/card-grid-before.png` e `card-grid-after.png` foram inspecionadas
lado a lado, e `card-grid-after-200.png` confirmou cantos, gradiente, sombra e glow na escala
200%. O teste `test_layerBudget` impede que o gradiente volte a usar camada/máscara e mantém a
sombra isolada. A suíte QML terminou com 101 testes aprovados.

Para repetir, compile o executável e use
`gamestock_native.exe --profile-dir <perfil> --fixture-db <perfil>\gamestock.db --media-dir <mídia> --content-size 1122x957 --capture cards.png`
com um banco sintético; a contagem de camadas é verificada por `scripts/native-qml-test.ps1`.

## Estatísticas de armazenamento (15/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, Qt 6.8.3 Release. A varredura usa a mesma rotina de
`SettingsService` (`QDirIterator` recursivo com arquivos ocultos e de sistema) em diretórios
temporários; nenhum perfil real é aberto.

| Perfil | Arquivos | Tempo da varredura |
|---|---:|---:|
| Fixture sintética pequena | 7 | 1,3 ms |
| Massa sintética em 200 pastas | 20.000 | 384–447 ms |

A varredura já roda em `QtConcurrent` e o resultado só alimenta propriedades; a interface mostra
`carregando` enquanto isso. O cache de 30 s evita repetir a leitura ao alternar entre as abas
Sobre e Backup. A busca sob demanda já é o comportamento atual: o serviço só é acionado quando
o painel fica visível, e uma chamada durante uma varredura não inicia outra.

Avaliei cache por diretório com invalidação por `lastModified` e `QFileSystemWatcher`: a data da
pasta muda ao adicionar/remover arquivos, mas não quando um arquivo cresce no lugar, e o watcher
do Qt não é recursivo. Para manter a correção diante de alterações externas seria necessário
observar todas as subpastas ou continuar fazendo `stat` em cada arquivo, o que anula o ganho.
Também não há categoria exibida na UI que justifique totais parciais. Por isso o código de
produção foi mantido; o limite de 30 s continua sendo a única política de atualização.

Para repetir, compile `native_benchmark` e execute
`native\build\windows-msvc\Release\native_benchmark.exe --profile-size <diretório>`. A massa
com 20.000 arquivos pode ser recriada com 200 pastas de 100 arquivos vazios.

## Empacotamento por formato (14/11/2026)

Windows 11, Ryzen 7 5800X, 32 GiB, mesma build Release e mesmo staging local. Foram executadas
medições únicas, em sequência, com cache de disco variável; os tempos não são garantias para outras
máquinas. Os tempos incluem o cálculo de SHA-256, mas não incluem compilação nem deploy.

| Pacote | Compressão | Tempo | Tamanho |
|---|---|---:|---:|
| Instalador | LZMA sólido (padrão) | 26,5 s | 24.412.443 bytes |
| Instalador | zlib | 13,0 s | 36.571.575 bytes |
| Portátil | ZIP (`Compress-Archive`) | 29,8 s | 36.897.779 bytes |

Nesta amostra o zlib reduziu o tempo do instalador em 13,5 s, com aumento de 12.159.132 bytes.
LZMA continua sendo o padrão; a alternativa é opcional. O modo padrão que gera ambos levou 26,2 s
para o instalador e 23,5 s para o ZIP em uma segunda passagem. Os dois instaladores e o ZIP foram
verificados com 7-Zip; o SHA-256 do executável extraído foi comparado ao staging, e a presença do
marcador portátil foi verificada. Isso não substitui a instalação em uma máquina limpa.

Para repetir sem usar perfis reais, compile com `scripts/native-release.ps1 -BuildOnly`, prepare o
staging com `scripts/native-deploy.ps1 -OutputDirectory native/build/package-staging/windows` e use
`scripts/native-installer.ps1 -SkipDeploy -PackageFormat Installer -InstallerCompression LZMA`
ou `Zlib`; use `-PackageFormat Portable` para o ZIP. Aponte `-OutputDirectory` para uma pasta
descartável diferente para cada medição.

Data: 02/11/2026 · Windows 11 · AMD Ryzen 7 5800X · 32 GiB · Qt 6.8.3 · Electron 43.3.0

Todas as medições usam cópias sintéticas da fixture `fixtures-H6UzzV`; nenhum perfil real é aberto.
Os números são de uma única máquina e **não autorizam afirmar ganho geral** de memória ou velocidade.

## Paginação (2.502 grupos, 5.000 jogos)

| Consulta | Electron | Qt |
|---|---:|---:|
| Página 1 | 9,6 ms | 15,7 ms |
| Página 2 | 9,5 ms | 15,3 ms |
| Página 10 | 9,4 ms | 14,5 ms |
| Busca + favoritos | 4,2 ms | 6,0 ms |
| Ordenação por mais jogados | 9,6 ms | 15,0 ms |
| Gênero `AÇÃO` + favoritos | 24,6 ms | 12,7 ms |
| Gênero `ς` | 58,3 ms | 6,0 ms |
| Gênero `İ` | 60,0 ms | 7,0 ms |

Electron inclui IPC/renderer no tempo; Qt mede a chamada direta ao `GameService` no processo nativo.
As consultas de gênero com sigma grego e I pontuado são as mais caras no Electron e baratas no Qt.

```powershell
native\build\windows-msvc\Release\native_benchmark.exe artifacts\native-migration\qt-benchmark\gamestock.db
```

## Inicialização e memória (janela principal)

Medição externa: tempo até `MainWindowHandle` e soma de `WorkingSet64` após 5 s de janela aberta.

| Runtime | Inicialização | Memória residente | Processos |
|---|---:|---:|---:|
| Electron | 6,2–6,8 s | 419 MB | 4 |
| Qt | 1,7 s | 255–260 MB | 1 |

O relatório interno do Qt (`--startup-report`) mede o primeiro quadro: **1,43–1,46 s** e
**271 MB** em três execuções. O `rendererFoundMs` do Electron (258 ms) mede apenas a
disponibilidade do DevTools, não o primeiro quadro, e não é comparável.

```powershell
native\build\windows-msvc\Release\gamestock_native.exe --profile-dir <perfil> `
  --fixture-db <perfil>\gamestock.db --startup-report <saida>.json
```

## Importação de 1.200 ROMs

Pasta sintética com 1.200 arquivos `.nes`, detecção automática, mesma massa nos dois runtimes:

| Runtime | Tempo | Registros |
|---|---:|---:|
| Electron | 7.640 ms | 1.200 |
| Qt | 5.179 ms | 1.200 |

```powershell
node tools\legacy-runtime\scripts\native-electron-import-benchmark.cjs
native\build\windows-msvc\Release\native_benchmark.exe --import 1200
```

O Electron usa o banco da fixture com `Metadata.xml` mínimo local; o Qt cria banco temporário pelas
mesmas migrations. Ambos caem no mesmo caminho de placeholders, mas a diferença de preparação do
banco impede tratar os tempos como benchmark micro-otimizado. O script Electron é histórico e exige
o backend congelado e as dependências de tooling.

## Leitura dos resultados

- A memória do Qt é de um processo único; a do Electron soma main, renderers e GPU.
- A inicialização externa mede a criação da janela, não o primeiro quadro; o Qt também reporta o
  primeiro quadro separadamente.
- Os tempos de paginação medem camadas diferentes (IPC/renderer versus serviço nativo).
- Não há conclusão de ganho por componente; apenas os valores medidos ficam registrados para a
  revisão de corte.
