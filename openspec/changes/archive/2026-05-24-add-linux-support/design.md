## Context

Hoje o GameStock ainda está acoplado a Windows em pontos centrais do produto:

- `package.json` expõe apenas `dev:windows`, `dist:windows` e testes com `set ... && electron`.
- `electron-builder.yml` gera somente `nsis` e `portable`.
- `scripts/package-s3-release.cjs` empacota apenas `release/win-unpacked`.
- `src/main/index.ts` exige `fs.existsSync(emulator.executable)`, o que quebra executáveis resolvidos por `PATH`.
- `src/renderer/components/EmulatorsSettings/EmulatorsSettings.tsx` ainda força rótulo `.dll` para cores do RetroArch.
- `src/main/updater.ts` aplica update sobrescrevendo `process.resourcesPath`, estratégia válida para Windows empacotado, mas inadequada para `.deb` e `AppImage`.
- `src/main/appPaths.ts` já tenta ser multiplataforma, porém usa diretório de configuração no Linux para armazenar banco, imagens e cache.

O pedido desta mudança é tornar o aplicativo compatível com Linux, com prioridade para distribuições baseadas em Ubuntu sem limitar a execução a elas.

## Goals / Non-Goals

**Goals:**

- Gerar builds Linux x86_64 distribuíveis para Ubuntu-based e outras distros desktop.
- Remover dependências explícitas de Windows em scripts operacionais do projeto.
- Armazenar dados persistentes do app em paths adequados no Linux.
- Permitir cadastro e lançamento de emuladores Linux por path absoluto, relativo ou comando resolvido via `PATH`.
- Corrigir a experiência de RetroArch no Linux, incluindo extensões `.so`.
- Impedir que builds Linux tentem aplicar update in-place por sobrescrita local.
- Documentar instalação, build e troubleshooting Linux no README.

**Non-Goals:**

- Publicar Snap, Flatpak ou RPM nesta primeira entrega.
- Suportar Linux ARM64 nesta primeira entrega.
- Distribuir emuladores, cores RetroArch ou bibliotecas de sistema junto com o app.
- Reescrever o updater para usar `electron-updater` ou outro serviço externo.
- Separar imediatamente config/cache/state em múltiplos diretórios XDG.

## Decisions

### D1 — Matriz oficial de distribuição Linux: `.deb` + `AppImage`

Linux terá dois formatos oficiais:

- `.deb` para Ubuntu, Linux Mint, Pop!_OS e demais derivadas Debian/Ubuntu.
- `AppImage` para distribuição genérica em desktops Linux x86_64 fora do ecossistema Debian.

Alternativas descartadas:

- Somente `.deb`: ruim para Fedora, Arch e outras bases.
- Somente `AppImage`: pior integração para público Ubuntu-first.
- Snap/Flatpak já na primeira entrega: aumentaria escopo operacional sem necessidade para viabilizar compatibilidade inicial.

### D2 — Scripts cross-platform via wrappers Node, não via shell específica

Os comandos de dev/build/teste passarão a chamar wrappers Node para limpar `ELECTRON_RUN_AS_NODE`, subir Electron e montar argumentos sem depender de `set`, `export` ou sintaxe particular de shell.

Alternativas descartadas:

- Manter scripts separados por SO: tende a duplicar fluxo e divergir rapidamente.
- Adicionar `cross-env` como única solução: resolve variáveis, mas não centraliza a lógica de bootstrap do Electron e dos testes.

### D3 — Diretório de dados Linux em `XDG_DATA_HOME`

No Linux, o diretório raiz persistente do app passa a ser:

- `$XDG_DATA_HOME/gamestock`, quando definido.
- `~/.local/share/gamestock`, como fallback.

`GAMESTOCK_USER_DATA_DIR` continua com precedência máxima para testes, portáveis e troubleshooting. Nesta mudança, banco, imagens, cache e estado de janela continuam sob uma única raiz para reduzir risco de regressão.

Alternativa descartada:

- Separar tudo entre `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME` e `XDG_STATE_HOME` agora. Tecnicamente mais puro, mas aumenta a migração e o número de pontos tocados sem ser necessário para destravar Linux.

### D4 — Resolução de executável por helper único, sem `shell: true`

O lançamento de emuladores passa a usar um helper comum com esta ordem:

1. Se o valor parece caminho (`/`, `./`, `../`, drive letter ou separador), resolver no filesystem.
2. Se não parece caminho, procurar comando no `PATH`.
3. Em plataformas POSIX, quando o resultado for arquivo local, validar bit de execução antes de `spawn`.

O `spawn` continua direto, sem `shell: true`, para preservar escaping previsível de argumentos e reduzir risco de executar shell intermediário com quoting inconsistente.

### D5 — RetroArch continua armazenando nome lógico de core, mas UI e resolução ficam multiplataforma

O banco e os imports continuam aceitando nome base de core (`snes9x_libretro`) ou caminho explícito do usuário. A resolução final no main tenta `.dll`, `.so` e `.dylib`. A UI deixa de hardcodar `.dll` e passa a mostrar:

- extensão compatível com a plataforma atual quando o valor vier do inventário instalado;
- caminho completo quando o usuário informar um path customizado.

Alternativa descartada:

- Persistir sempre o caminho absoluto completo do core. Isso reduz portabilidade entre máquinas e piora restore/import de backup.

### D6 — Self-update fica restrito a Windows empacotado

O updater atual por staging e sobrescrita local continuará ativo apenas em builds Windows empacotadas. Em Linux:

- startup não baixa nem aplica ZIP;
- checagem manual pode consultar metadados, mas só informa que a atualização é externa ao app;
- documentação aponta para pacote `.deb`, `AppImage` atualizado ou gerenciador de pacotes da distribuição.

Alternativa descartada:

- Tentar reaproveitar a sobrescrita de `process.resourcesPath` em `.deb`/`AppImage`. Isso conflita com permissões, assinatura do pacote, montagem somente-leitura e práticas normais de distribuição Linux.

### D7 — Validação mínima: Ubuntu-based + uma distro não-Debian

A entrega considera Linux compatível apenas após:

- smoke de build Linux concluído;
- teste manual de runtime em uma distro Ubuntu-based;
- teste manual do `AppImage` em ao menos uma distro fora da família Debian, assumindo Fedora como baseline inicial.

## Risks / Trade-offs

- Módulos nativos (`better-sqlite3`, `sharp`) podem falhar em ambientes Linux incompletos → documentar pré-requisitos, validar `postinstall` e incluir smoke de build Linux.
- `AppImage` pode depender de FUSE/libfuse em parte das distros → manter `.deb` como formato principal para Ubuntu-based e documentar troubleshooting.
- Resolução por `PATH` pode abrir binário inesperado quando nomes colidem → registrar caminho resolvido nos logs/erros internos e manter campo editável pelo usuário.
- Manter um único diretório raiz em `XDG_DATA_HOME` não segue 100% do ecossistema XDG → aceitar dívida pequena agora para reduzir migração e regressão.
- Desabilitar self-update no Linux reduz conveniência → compensar com documentação clara e checagem manual informativa.

## Migration Plan

1. Introduzir scripts cross-platform e targets Linux no builder sem remover a distribuição Windows existente.
2. Ajustar helpers de paths, launcher e UI de emuladores/RetroArch.
3. Colocar guardas explícitas no updater para Linux.
4. Atualizar README com instalação, build e troubleshooting Linux.
5. Gerar primeira release Linux com `.deb` e `AppImage`.
6. Validar runtime em Ubuntu-based e Fedora antes de anunciar suporte oficial.

Rollback:

- manter targets Windows intactos;
- desabilitar publicação Linux se algum ponto crítico de build/runtime falhar;
- preservar `GAMESTOCK_USER_DATA_DIR` para contornar issues de path durante investigação.

## Open Questions

- Nenhuma bloqueante para iniciar implementação.
- Primeira release Linux assume apenas `x86_64`; expansão para `arm64` fica para mudança posterior.
