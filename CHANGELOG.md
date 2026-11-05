<!-- Registrar mudanças de produto e manutenção sem publicar releases automaticamente. -->
# Changelog

Todas as mudancas relevantes do GameStock sao registradas neste arquivo.

## [1.1.6] - 2026-11-05

### Adicionado

- Consultas da biblioteca em thread própria (`LibraryQueryWorker`) com conexão somente leitura e descarte de respostas obsoletas por geração.
- Cache de gêneros, partidas e capas até a próxima mutação; a abertura carrega a primeira página antes dos agregados.
- Coluna `title_normalized` com índice e migration de backfill, cobrindo acentos e maiúsculas Unicode na busca.
- Cache de capas já decodificadas no tamanho exibido pelo provider de mídia.
- Teste assíncrono de biblioteca e benchmark de consultas após importação grande.

### Alterado

- SQLite passa a usar WAL e `synchronous=NORMAL` em todas as conexões.
- Inventário, formulário de jogo, página de detalhe e abas de Configurações são criados sob demanda.
- Estatísticas do perfil são calculadas em segundo plano, descartando varreduras antigas.
- Execução pelo workspace passa a abrir o perfil existente por padrão; testes usam perfil explícito.
- Build/deploy usam 7-Zip local com licenças; instalador e portátil são gerados da mesma build em release/.
- Retirados backend de referência Electron, dependências npm e ferramentas legadas; fixtures SQL/backups congelados mantêm os testes de compatibilidade sem o runtime antigo.

### Corrigido

- Importador LaunchBox volta a buscar: o pacote atual traz `Metadata.xml`, `Mame.xml`, `Files.xml` e `Platforms.xml`, e a extração passa a escolher o `Metadata.xml` em vez do primeiro XML. Cache com dataset errado ou vazio é rejeitado e o cache volta para `<perfil>/launchbox_cache`.
- Índice LaunchBox passa a ficar em memória entre buscas/importações da mesma sessão, como no Electron; a primeira preparação carrega os ~300 MB uma vez e as buscas seguintes são imediatas.
- Instalador passa a criar atalho na Área de Trabalho e o executável embute o ícone do aplicativo, usado por Explorer, barra de tarefas e atalhos.
- Verificada a compatibilidade do perfil existente em cópia, preservando dados e caminhos.
- Corrigida a orientação de capas reais sem ciclo de binding ou mudança de layout.
- Restaurados ampliação, navegação e salvamento da galeria; seleção de capa passa a copiá-la para o perfil e caminhos de ROM preservam espaços e acentos.

## [1.1.5] - 2026-11-03

### Alterado

- Runtime desktop migrado de Electron para C++20 + Qt 6 Quick/QML, sem dependencias de Node, Chromium ou WebView no executavel final.
- Tipografia, espacamentos e layout calibrados contra as medidas do DOM do renderer Electron de referencia (biblioteca, inventario, configuracoes, formularios e dialogos).
- Painel de detalhe do jogo alinhado ao CSS original: espacamento dos titulos, altura de linha da descricao e largura da lista de arquivos encontrados.
- Icones dos cards de status do backup com 18 px, conforme o DOM de referencia.

## [1.1.4] - 2026-09-28

### Adicionado

- OpenVGDB como fonte alternativa de metadados e Libretro como fonte alternativa de capas e screenshots.

### Corrigido

- Busca de metadados no formulario limitada ao console do jogo, incluindo aliases e nomes regionais.

## [1.1.3] - 2026-09-05

### Adicionado

- Teste de regressao isolado para consultas da biblioteca e cache LaunchBox, cobrindo filtros, variantes, paginacao, banco existente, cache corrompido e concorrencia.

### Alterado

- Listagem da biblioteca passou a ordenar somente campos leves antes de carregar os dados completos da pagina selecionada.
- Contagens da sidebar foram consolidadas de seis consultas SQLite para duas, preservando filtros cruzados e agrupamento de variantes.
- Listagem de generos agora elimina valores repetidos diretamente no SQLite antes de processa-los no main process.
- Versao do aplicativo atualizada para 1.1.3.

### Corrigido

- Leitura e desserializacao do indice LaunchBox movidas para worker, evitando travamento do processo principal com caches grandes.
- Downloads e indexacoes LaunchBox simultaneos agora compartilham a mesma operacao e nao disputam os arquivos do cache.
- Cache LaunchBox parcial ou corrompido e reconstruido automaticamente a partir do XML.
- Ordenacao ganhou desempate estavel por ID, evitando itens repetidos ou ausentes entre paginas.
- Lista de cores do RetroArch agora mostra todo o inventario instalado, recarrega ao voltar para o app e nao conserva valores antigos em linhas sem edicao pendente.

## [1.1.2] - 2026-08-22

### Adicionado

- Opcao para exibir ou ocultar jogos sem capa na biblioteca.
- Atualizacao individual de dados e imagens LaunchBox pelo formulario de edicao, com notificacao de progresso.
- Modos de sincronizacao de midia: completar somente pendencias ou atualizar todos os jogos vinculados, incluindo capa, fundo e screenshot.
- Loading animado nos botoes Jogar da tela de detalhe, grade e lista.

### Alterado

- Busca sempre consulta toda a biblioteca e limpa filtros ativos antes de pesquisar.
- Filtros de colecao e console agora podem ser combinados; "Todos os jogos" mostra contagem do console selecionado.
- Grade de capas centralizada e controles de sincronizacao de midia reorganizados.

### Corrigido

- Busca iniciada no detalhe de um jogo retorna corretamente para a biblioteca.

## [1.1.1] - 2026-08-18

### Adicionado

- Paginacao SQL real na biblioteca, com agrupamento de variantes preservado por `library_group_key` e migration incremental para bancos existentes.
- Leitura e escrita em lote de vinculos plataforma-emulador, incluindo gravacao transacional dos cores RetroArch.
- Carregamento sob demanda das secoes pesadas de Configuracoes.
- Assets WebP otimizados para logo e splash screen.

### Alterado

- Empacotamento Electron Builder agora usa whitelist de runtime e inclui somente binario `7zip-bin` adequado ao alvo.
- Eventos de progresso do LaunchBox sao limitados para reduzir atualizacoes intermediarias no renderer.
- Fluxo de portabilidade separa operacoes de midia em modulo proprio; registradores IPC de plataformas e emuladores foram extraidos do bootstrap principal.

### Corrigido

- Inventario nao dispara consulta para pagina antiga ao mudar filtros ou ordenacao.
- Hooks de jogos, plataformas e contagens de colecao tratam falhas IPC sem apagar estado valido.

## [1.1.0] - 2026-08-09

### Adicionado

- Atualizacao automatica para instalacoes Windows NSIS usando GitHub Releases e artefatos padrao do `electron-builder`.
- Sincronizacao incremental de pastas de ROM no inicio do aplicativo.
- Extracao de ROMs compactadas antes do launch e acao para limpar cache de extracao.
- Filtro por categoria na biblioteca, melhorias no agrupamento de variantes e galeria de midia.

### Alterado

- Build Windows agora gera `latest.yml`, instalador NSIS, `.blockmap` e executavel portatil prontos para upload na GitHub Release.
- Tela Sobre e acoes da sidebar receberam ajustes de layout e usabilidade.
- Busca de metadados LaunchBox e seletor de cores do RetroArch receberam melhorias de interacao.

### Corrigido

- Consolidacao de aliases legados de plataformas.
- Duplicacao de imagens e agrupamento incorreto de variantes de ROM.
- Progresso de sincronizacao de midia por job.

[1.1.0]: https://github.com/alexishida/games-stock/releases/tag/v1.1.0
[1.1.1]: https://github.com/alexishida/games-stock/releases/tag/v1.1.1
[1.1.2]: https://github.com/alexishida/games-stock/releases/tag/v1.1.2
[1.1.3]: https://github.com/alexishida/games-stock/releases/tag/v1.1.3
[1.1.4]: https://github.com/alexishida/games-stock/releases/tag/v1.1.4
