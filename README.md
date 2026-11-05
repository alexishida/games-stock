<!-- Projeto oficial nativo; os relatórios da migração são referências históricas. -->
# GameStock

GameStock é um aplicativo desktop para Windows e Linux que organiza bibliotecas de jogos retrô,
ROMs, capas, metadados e inventário físico. O runtime oficial é **C++20 + Qt 6 Quick/QML**, com
SQLite local via QSQLITE. Electron/React e seu backend de referência foram removidos. A compatibilidade é verificada por
fixtures SQL e backups sintéticos congelados, sem manter o projeto antigo.

Versão atual: **1.1.5**.

## Capturas de tela

![Biblioteca principal](screenshot/principal.jpg)

![Detalhe do jogo](screenshot/detail.jpg)

![Inventário físico](screenshot/inventario.jpg)

![Formulário do inventário físico](screenshot/inventario-form.jpg)

![Backup e portabilidade de dados](screenshot/backup.jpg)

## Funcionalidades

- **Biblioteca de jogos**: cadastro, edição, exclusão, favoritos, status e consulta com paginação SQL.
- **Grade e lista**: cards com capas ou lista compacta, com teclado, contadores e ordenação.
- **Detalhe do jogo**: capa, fundo, screenshot, metadados, ROM, versões e formulário.
- **Importação de metadados**: LaunchBox/OpenVGDB/Libretro com cache local, busca e mídia.
- **Filtros e busca**: coleções, plataformas, gêneros e busca em tempo real.
- **Plataformas**: CRUD, aliases de busca e extensões aceitas por plataforma.
- **Emuladores**: CRUD, emulador padrão, vínculos por plataforma e RetroArch com cores.
- **Importação por pasta**: scan, revisão, subpastas, detecção automática e jobs em background.
- **Sincronização de mídia**: capas, fundos e screenshots com progresso e retomada.
- **Notificações de jobs**: cards por status, persistência de transições e dispensa.
- **Inventário físico**: itens, tipos, conservação, fotos, cards/lista, filtros e detalhe.
- **Portabilidade**: backup `.gamestock-backup` ZIP64 com cinco categorias, preview, staging e
  rollback. Compatível com pacotes gerados pelo Electron.
- **Atualizações**: manifesto assinado publicado no GitHub Releases, verificação de SHA-256/tamanho,
  splash com timeout/offline e atualização externa para portátil/Linux.
- **Dados locais**: banco, imagens, cache e geometria da janela no diretório de dados do usuário.

## Instalação

Usuários Windows podem usar:

- `GameStock-<versão>-Setup.exe` — instalador por usuário em
  `%LOCALAPPDATA%\Programs\GameStock`;
- `GameStock-<versão>-Portable.zip` — pasta portátil com `portable.marker`.

O perfil fica em `%APPDATA%\gamestock` (ou `GAMESTOCK_USER_DATA_DIR`) e é preservado na
desinstalação. Não é necessário Node.js, Qt ou Visual Studio para executar.

## Desenvolvimento

Requisitos: Windows 11 + MSVC 2022 x64, CMake 3.25+, Qt 6.8.3 local em
`.native-tools/Qt/6.8.3/msvc2022_64`. Python 3 com biblioteca padrão é usado apenas pelas ferramentas de fixtures.
Não há dependência de Node, npm ou Electron no build, nos testes ou na distribuição.

```powershell
cmake --preset windows-msvc -S native
cmake --build native/build/windows-msvc --config Release --parallel 4
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
```

Deploy local, instalador e assinatura:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/native-deploy.ps1 -SkipBuild
powershell -ExecutionPolicy Bypass -File scripts/native-installer.ps1
powershell -ExecutionPolicy Bypass -File scripts/native-sign-update.ps1 `
  -PayloadPath update-payload.json -OutputPath latest.json
```

O app abre o perfil real por padrão. Para testes use `--profile-dir` e `--fixture-db` com uma cópia
sintética. O atalho `scripts/native-run.cmd` abre o mesmo perfil existente do usuário; não cria uma biblioteca de teste silenciosamente.

## Reaproveitar os dados existentes

O aplicativo resolve o mesmo caminho do Electron: `%APPDATA%/gamestock` no Windows,
ou `GAMESTOCK_USER_DATA_DIR` quando definido. Jogos, IDs, mídias, emuladores, pastas e
preferências permanecem nesse perfil. Não é preciso mover a pasta, exportar ou reimportar.
Feche o aplicativo antigo antes de abrir o novo.

A abertura foi validada em cópia do perfil existente, com comparação das 12 tabelas, sem
alterar o banco original. Veja o [relatório](docs/native-migration/current-project-audit.md).
Para abrir pelo workspace: `scripts/native-run.cmd`. Para uma cópia de teste, use
`--profile-dir <diretorio>`. Não use fixtures para testar sobre seu perfil pessoal.

## Organização

- `native/`: aplicativo C++/QML, testes, assets e dependências vendorizadas.
- `scripts/`: execução, testes, fixtures e distribuição; [guia de comandos](scripts/README.md).
- `docs/`: documentação e evidências; [índice](docs/README.md).
- `openspec/`: contratos atuais e histórico das mudanças.
- `screenshot/` e `materiais/`: capturas publicáveis e materiais da marca.
- `.native-tools/`, `native/build/`, `release/` e `artifacts/`: ferramentas e saídas locais ignoradas pelo Git.

## Atualizações

O feed é `https://github.com/alexishida/games-stock/releases/latest/download/latest.json`. A chave
privada fica em `%USERPROFILE%\.gamestock\update-signing-key.json`, fora do repositório; apenas a
pública é embutida. A publicação no GitHub é manual.

## Documentação

- [Regras para IA](.ai-framework/RULES.md)
- [Design](.ai-framework/DESIGN.md)
- [Migração nativa](docs/native-migration/)
- [Instalador e portátil](docs/native-migration/installer.md)
- [Atualizações assinadas](docs/native-migration/updates.md)
- [Backup e compatibilidade](docs/native-migration/backup.md)
- [Release/corte](docs/native-migration/release-cut.md)

## Linux

O preset `linux-gcc` existe, mas build, capturas, `.deb` e AppImage continuam adiados por decisão do
usuário. Consulte [linux-deferred.md](docs/native-migration/linux-deferred.md).
