<!-- Estado consolidado sem arquivar a mudança ou alterar evidências históricas. -->
> **Estado atual consolidado:** o runtime oficial já é C++20 + Qt 6.8.3 Quick/QML; Electron/React foram retirados. As specs em `openspec/specs/` refletem os contratos nativos atuais, incluindo abertura e atualização. O usuário aprovou o design/layout nativo existente como referência a preservar. Descrições abaixo sobre Electron como runtime atual, paridade futura e ponte de instalação registram o planejamento histórico; Linux permanece adiado e publicação externa é separada.

<!-- Proposta da migração integral, preservando identidade visual e dados do usuário. -->
# Proposal

## Why

Migrar o GameStock para uma aplicação desktop com backend C++ e telas Qt Quick/QML, substituindo Electron e React sem perder o design atual nem funcionalidades. A mudança deve reaproveitar o SQLite, as mídias, os backups e as configurações de quem já usa o aplicativo, sem exigir reimportação.

## What Changes

- Reconstruir todas as telas em QML com fidelidade ao aplicativo atual e aos tokens de `.ai-framework/DESIGN.md`, começando por um protótipo comparável da biblioteca.
- Portar serviços, DAOs, importadores, jobs, execução de emuladores, logs e portabilidade para C++, com processamento pesado fora da thread gráfica.
- Preservar o banco existente, migrations, caminhos, formatos persistidos e pacotes `.gamestock-backup`, incluindo inventário e ZIP64.
- Manter Windows 11 e Linux x86_64, instalador/portátil Windows e `.deb`/AppImage Linux.
- Planejar uma ponte de atualização da instalação Electron para Qt e manter o fluxo de atualização externa no Linux/portátil.
- **BREAKING**: substituir a API interna `window.gameStockAPI`/IPC por serviços tipados C++ e modelos QML; remover Node.js, Electron e React do runtime final. Identificadores de operações permanecem como referência de equivalência funcional, sem obrigação de manter uma API JavaScript pública.
- Manter as versões Electron e Qt compiláveis durante a transição; retirar a implementação antiga somente após os critérios de paridade.

## Capabilities

### New Capabilities

- `desktop-data-compatibility`: abertura segura de dados existentes, compatibilidade de backups e retomada de estado persistido durante a troca de runtime.

### Modified Capabilities

- `app-shell`: janela Qt, fronteira de serviços e acesso seguro a mídia local.
- `library-ui`: fidelidade visual e interação dos componentes reconstruídos.
- `game-library`: substituir a interface IPC mantendo operações e resultados.
- `game-launch`: substituir o ponto de entrada IPC mantendo execução e variantes.
- `platform-manager`: preservar gerenciamento por serviços desktop.
- `emulator-management`: preservar CRUD e resolução de executáveis por serviços desktop.
- `library-management-workflows`: ações de navegação sem dependência de canais Electron.
- `rom-folder-import`: progresso, comandos e persistência sem renderer/IPC Electron.
- `launchbox-scraper`: processamento nativo mantendo cache, mídia e resultados.
- `data-portability`: serviços nativos, progresso e entradas de pastas persistidas no backend.
- `auto-update`: atualizar distribuição Qt e oferecer transição para instalações Electron.
- `splash-screen`: consumir estado do serviço nativo de atualização.
- `linux-support`: documentar build e diagnóstico gráfico próprios do Qt.

## Impact

Novo projeto `native/` com CMake, C++20, Qt 6 e QML. Migração de `src/main`, `src/preload`, `src/renderer`, contratos em `src/shared`, scripts e pipelines de distribuição; atualização futura do README e das regras técnicas do projeto. O inventário físico conserva integralmente o contrato de `hardware-inventory`, sem alteração funcional de seus requisitos.

Não se presume ganho de memória, inicialização ou velocidade: comparar release builds com as mesmas massas antes de declarar resultados. A seleção exata da versão Qt, toolchain e bibliotecas de arquivo compactado deve ser fixada e documentada na etapa inicial, incluindo licenças e redistribuição.

