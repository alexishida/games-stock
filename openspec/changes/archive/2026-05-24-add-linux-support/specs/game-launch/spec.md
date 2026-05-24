## MODIFIED Requirements

### Requirement: Lançamento de jogo via IPC

O sistema SHALL expor via `window.gameStockAPI.games` o método `launch(gameId)` que resolve o emulador padrão da plataforma do jogo e spawna o processo. O executável do emulador SHALL aceitar caminho absoluto, caminho relativo ou nome de comando resolvível via `PATH`. Em plataformas POSIX, quando o executável resolvido apontar para arquivo local, o sistema SHALL validar permissão de execução antes do `spawn`. O comando varia por tipo de emulador:

- **Standalone** (`is_retroarch = 0`): `spawn(resolvedExecutable, [...parsedArgs, romPath])`
- **RetroArch** (`is_retroarch = 1`): `spawn(resolvedExecutable, ["-L", corePath, romPath])`

#### Scenario: Lançar jogo com emulador standalone

- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 0`
- **THEN** o processo é iniciado com `resolvedExecutable [...args, rom_path]` e retorna `{ success: true }`

#### Scenario: Lançar jogo via RetroArch

- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 1`
- **THEN** o processo é iniciado com `resolvedExecutable -L <corePath> <rom_path>` e retorna `{ success: true }`

#### Scenario: Lançar jogo com comando resolvido via PATH

- **WHEN** `games.launch(gameId)` é chamado para um emulador com `executable = "retroarch"` e o comando existe no `PATH`
- **THEN** o sistema resolve o binário no ambiente atual e inicia o processo normalmente

#### Scenario: Lançar jogo sem ROM path

- **WHEN** `games.launch(gameId)` é chamado para um jogo sem `rom_path`
- **THEN** o sistema retorna erro "Jogo não possui caminho de ROM configurado"

#### Scenario: Lançar jogo sem emulador padrão na plataforma

- **WHEN** `games.launch(gameId)` é chamado e a plataforma do jogo não tem emulador padrão
- **THEN** o sistema retorna erro "Nenhum emulador padrão configurado para esta plataforma"

#### Scenario: Executável do emulador não encontrado

- **WHEN** `games.launch(gameId)` é chamado e o caminho informado não existe no sistema de arquivos nem pode ser resolvido pelo `PATH`
- **THEN** o sistema retorna erro "Executável do emulador não encontrado: <path>"

#### Scenario: Executável do emulador sem permissão no Linux

- **WHEN** `games.launch(gameId)` é chamado em Linux e o executável resolvido existe, mas não possui permissão de execução
- **THEN** o sistema retorna erro "Executável do emulador sem permissão de execução: <path>"
