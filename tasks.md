<!-- Plano de otimização: medir com dados sintéticos e preservar bancos existentes. -->
# Otimização de desempenho

Os pontos abaixo são oportunidades identificadas na análise do código. Medir o impacto antes e depois com perfis sintéticos, preservando dados de instalações existentes, aparência e comportamento.

## Medição inicial

- [x] **Ponto encontrado:** faltam medições comparáveis para as operações abaixo em bibliotecas de tamanhos diferentes.
  **Medições registradas:** ambiente, fixtures sintéticas e resultados de abertura, busca/paginação (5.000 e 50.000 jogos), importação, memória, empacotamento, inventário (30.000 itens), busca LaunchBox (50.000 jogos), downloads de mídia, cards (100% e 200%) e armazenamento (20.000 arquivos) estão em `docs/native-migration/benchmark.md`. A rolagem foi validada pelos testes QML de roda, paginação e capturas de 100% e 200%; não foi criado um contador de quadros dedicado porque o backend de teste é software e não representa a GPU.

## Miniaturas do inventário — prioridade alta

- [x] **Ponto encontrado:** os cards carregavam imagens sem solicitar tamanho de decodificação. Arquivo: `native/qml/components/HardwareItemCard.qml`.
  **Melhoria implementada:** miniaturas ajustadas à densidade, com resolução suficiente para recortes, limite para panoramas extremos e suporte à orientação EXIF. Medições e comparação sintética em 100% e 200% estão em `docs/native-migration/benchmark.md`.

## Capas da biblioteca — prioridade alta

- [x] **Ponto encontrado:** os cards carregavam capas maiores que a área visível; o layout precisa distinguir capas horizontais e verticais. Arquivos: `native/qml/components/GameCard.qml` e `native/src/app/MediaReader.cpp`.
  **Melhoria implementada:** solicitar uma largura ajustada à densidade, preservando a proporção; uma sonda independente identifica a orientação e compartilha o cache. Validação de recorte e medições em 100% e 200% estão em `docs/native-migration/benchmark.md`.

## Inventário na thread da interface — prioridade alta

- [x] **Ponto encontrado:** a listagem sem filtros fazia duas consultas de contagem equivalentes. Arquivo: `native/src/db/dao/HardwareItemDao.cpp`.
  **Melhoria implementada:** reutilizar o total para a contagem filtrada quando não há condições; manter a consulta específica quando filtros estão ativos.

- [x] **Ponto encontrado:** buscas, ordenação, filtros e paginação executavam a leitura da lista na interface.
  **Melhoria implementada:** no modo interativo, consultar em background com conexão somente leitura criada no worker, condensar pedidos e descartar respostas antigas; mostrar carregamento enquanto a consulta está pendente. O contrato síncrono de chamadas diretas foi mantido.

- [x] **Ponto encontrado:** busca, filtros, paginação, cadastros auxiliares e cópia de fotos bloqueavam a thread da interface. Arquivo: `native/src/services/InventoryService.cpp`.
  **Melhoria implementada:** leitura da página e dos auxiliares em worker, com descarte de resultados antigos; cópia em job compartilhado com progresso, cancelamento cooperativo e gravação segura. A gravação já confirmada permanece concluída em cancelamento tardio. A validação e as medições com 30 mil itens e foto sintética de 48 MiB estão em `docs/native-migration/benchmark.md`.

## Contagens e paginação da biblioteca — prioridade alta

- [x] **Ponto encontrado:** cada consulta de página calcula contagens distintas e executa agrupamento e ordenação antes do limite. Arquivos: `native/src/db/dao/GameReadDao.cpp` e `native/src/services/LibraryQueryWorker.cpp`.
  **Melhoria implementada:** contagens totais, filtradas e da sidebar ficam em cache por combinação de filtros e geração de dados; abertura e `GameService::refresh()` avançam a geração, e o worker somente leitura mantém o próprio cache. Planos SQLite, medições com 5.000 e 50.000 jogos e a avaliação de três índices candidatos estão em `docs/native-migration/benchmark.md`; os índices não trouxeram ganho consistente e o schema não mudou. A seleção de representantes, a ordenação e o contrato síncrono foram preservados, com teste de reutilização e invalidação.

## Busca LaunchBox — prioridade média

- [x] **Ponto encontrado:** a busca ordenava todas as correspondências mesmo quando só uma parte seria exibida.
  **Melhoria implementada:** ordenar apenas os primeiros resultados necessários, mantendo prioridade dos resultados exatos e ordem estável para títulos iguais.

- [x] **Ponto encontrado:** cada busca percorre o índice e normaliza plataformas, títulos e aliases; as correspondências são ordenadas antes de aplicar o limite. A busca já ocorre em background. Arquivos: `native/src/launchbox/LaunchBoxSearch.cpp` e `native/src/services/MetadataService.cpp`.
  **Melhoria implementada:** uma visão do índice normaliza títulos, aliases e plataformas uma única vez, agrupa candidatos por plataforma e é reutilizada dentro do `LaunchBoxCache` até o índice mudar. Aliases, prioridade dos resultados exatos, ordenação estável, limite e o caminho de busca isolada foram preservados, com teste comparando as duas rotas. Medições com 50.000 jogos e o custo de memória estão em `docs/native-migration/benchmark.md`.

## Downloads de mídia — prioridade média

- [x] **Ponto encontrado:** as imagens são baixadas sequencialmente. Arquivo: `native/src/launchbox/LaunchBoxMedia.cpp`.
  **Melhoria implementada:** fila com até 3 conexões simultâneas (ajustável de 1 a 4), progresso monotônico, timeout e limite de tamanho por transferência, temporário único e publicação atômica; falhas isoladas não interrompem as demais nem apagam a imagem anterior, e a ordem dos arquivos no resultado é preservada. Medições com 12 imagens e latência sintética, além dos testes de concorrência e integridade, estão em `docs/native-migration/benchmark.md`.

## Cards e efeitos visuais — prioridade média

- [x] **Ponto encontrado:** as grades usam `Repeater` para criar os cards da página, e cada card pode usar camadas e efeitos gráficos. Arquivos: `native/qml/Main.qml`, `native/qml/components/HardwareInventoryPage.qml` e `native/qml/components/GameCard.qml`.
  **Melhoria implementada:** o `GridView` foi avaliado e recusado nesta paginação de 36 cards porque a criação preguiçosa reduziria o alcance do foco por Tab ou exigiria criar a página inteira. O `GameCard` passou de 5 para 3 camadas: sombra isolada do conteúdo e gradiente sem camada/máscara, com o mesmo raio e as mesmas paradas visuais. Capturas em 100% e 200%, estimativa de textura, variação de primeiro quadro/memória e o teste que fixa o orçamento de camadas estão em `docs/native-migration/benchmark.md`; a suíte QML passou com 101 testes.

## Estatísticas de armazenamento — prioridade baixa

- [x] **Ponto encontrado:** após o prazo do cache, calcular o tamanho do perfil percorre novamente seus arquivos. A varredura já ocorre em background. Arquivo: `native/src/services/SettingsService.cpp`.
  **Avaliação concluída:** 20.000 arquivos em 200 pastas levam 384–447 ms no worker, contra 1,3 ms na fixture pequena; o cache de 30 s e o carregamento sob demanda já evitam repetições e bloqueio da interface. Cache por pasta com `lastModified`/`QFileSystemWatcher` não detectaria arquivos que crescem no lugar nem alterações em subpastas, e totais por categoria não têm consumidor na UI atual. O código de produção foi mantido e o modo `--profile-size` foi adicionado ao `native_benchmark`; detalhes em `docs/native-migration/benchmark.md`.

## Empacotamento — prioridade média para desenvolvimento

- [x] **Ponto encontrado:** instalador e ZIP portátil eram gerados em sequência; uma execução anterior gastou cerca de 64 segundos nessa etapa. Arquivo: `scripts/native-installer.ps1`.
  **Melhoria implementada:** seleção independente de formatos e opção de comparação zlib, preservando LZMA como padrão. As medições, tamanhos e verificações de integridade estão em `docs/native-migration/benchmark.md`; o modo `-BuildOnly` dispensa o empacotamento.

## Validação final

- [x] **Ponto encontrado:** as melhorias precisam demonstrar ganhos reais e manter fluxos e dados existentes.
  **Validação concluída:** 31 testes CTest aprovados (DAOs, serviços, jobs, backup, updater, migrations, inventário) e 101 testes QML aprovados. As capturas da biblioteca foram comparadas em 100% e 200%; as mudanças sem medição visual foram mantidas fora de escopo. Todas as medições antes/depois estão em `docs/native-migration/benchmark.md`, obtidas com bancos e perfis sintéticos e fixtures anteriores. Não houve mudança de schema, migration, formato de backup ou pacote que exigisse reset, reimportação ou reinstalação; os bancos sintéticos existentes abriram normalmente.
