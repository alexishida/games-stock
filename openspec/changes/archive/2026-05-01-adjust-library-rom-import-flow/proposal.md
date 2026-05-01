## Por Que

O fluxo anterior exigia criar ou importar jogos individualmente. Isso ficava lento para coleções com muitas ROMs de uma mesma plataforma. Esta mudança adicionou importação em lote a partir de pastas locais.

## O Que Muda

- Fluxo de importação por pasta de ROMs.
- Seleção de pasta e plataforma.
- Descoberta de ROMs por extensão suportada.
- Normalização de título a partir do nome do arquivo.
- Match automático no índice LaunchBox por título e plataforma.
- Download de box art, background e screenshot.
- Criação/atualização da biblioteca sem duplicar jogos.
- Execução em background com notificações.
- Ação para continuar downloads.
- Exclusão de pasta do GameStock sem apagar a pasta física.
- Organização de imagens em `images/<platform>/<game>/`.

## Capacidades

### Nova Capacidade

- `rom-folder-import`

### Capacidades Modificadas

- `game-library`
- `launchbox-scraper`
- `rom-association`
- `library-management-workflows`

## Impacto

- Novos IPCs de scan/importação por pasta.
- Novo assistente no renderer.
- Novos eventos de progresso em background.
- Novos campos de mídia no banco.
- Testes smoke para importação por pasta.
