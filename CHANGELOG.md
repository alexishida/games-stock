# Changelog

Todas as mudancas relevantes do GameStock sao registradas neste arquivo.

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
