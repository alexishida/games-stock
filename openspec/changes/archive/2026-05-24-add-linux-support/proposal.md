## Why

O GameStock ainda nasce com premissas de Windows em scripts, empacotamento, paths de dados, documentação e fluxo de update. Isso bloqueia uso em Linux e aumenta risco de novas features reforçarem dependências de plataforma difíceis de remover depois.

## What Changes

- Adicionar suporte oficial de desktop Linux com baseline em distribuições baseadas em Ubuntu, sem restringir a execução a elas.
- Criar fluxo de desenvolvimento, build e distribuição para Linux com scripts cross-platform e targets Linux no empacotamento Electron.
- Tornar paths de dados e artefatos de runtime aderentes ao sistema operacional atual, incluindo diretórios XDG no Linux.
- Ajustar seleção, validação e lançamento de emuladores para formatos comuns de Linux, incluindo binários ELF, scripts executáveis e AppImage.
- Adaptar o fluxo de atualização para comportamento por plataforma: update in-place continua no Windows; builds Linux não tentam sobrescrever instalação gerenciada pelo sistema.
- Atualizar README e documentação operacional para instalação, dependências e troubleshooting em Linux.

## Capabilities

### New Capabilities

- `linux-support`: matriz de suporte, requisitos de runtime, formatos de distribuição e verificações mínimas para execução do app em desktops Linux.

### Modified Capabilities

- `app-shell`: startup, diretórios persistentes e scripts operacionais passam a respeitar Windows e Linux.
- `emulator-management`: cadastro e seleção de executáveis passam a aceitar formatos e validações nativas de Linux.
- `game-launch`: lançamento de jogos passa a tratar erros e caminhos de executáveis Linux de forma explícita.
- `auto-update`: builds Linux deixam de usar atualização automática por sobrescrita local e passam a orientar atualização manual/externa.

## Impact

- `package.json`, `electron-builder.yml` e scripts de release/dev/teste.
- `src/main/appPaths.ts`, bootstrap do Electron e módulos de launch/update.
- UI e IPC de configurações de emuladores e mensagens de erro de launch/update.
- README, pré-requisitos de ambiente e processo de distribuição para Linux.
