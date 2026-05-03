## ADDED Requirements

### Requirement: Lançamento de jogo via IPC
O sistema SHALL expor via `window.gameStockAPI.games` o método `launch(gameId)` que resolve o emulador padrão da plataforma do jogo e spawna o processo. O comando varia por tipo de emulador:
- **Standalone** (`is_retroarch = 0`): `spawn(executable, [...parsedArgs, romPath])`
- **RetroArch** (`is_retroarch = 1`): `spawn(executable, ['-L', corePath, romPath])`

#### Scenario: Lançar jogo com emulador standalone
- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 0`
- **THEN** o processo é iniciado com `executable [...args, rom_path]` e retorna `{ success: true }`

#### Scenario: Lançar jogo via RetroArch
- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 1`
- **THEN** o processo é iniciado com `retroarch -L <core_path> <rom_path>` e retorna `{ success: true }`

#### Scenario: Lançar jogo via RetroArch sem core configurado
- **WHEN** `games.launch(gameId)` é chamado, o emulador padrão é RetroArch, mas `core_path` está vazio
- **THEN** o sistema retorna erro "Core do RetroArch não configurado para esta plataforma"

#### Scenario: Lançar jogo sem ROM path
- **WHEN** `games.launch(gameId)` é chamado para um jogo sem `rom_path`
- **THEN** o sistema retorna erro "Jogo não possui caminho de ROM configurado"

#### Scenario: Lançar jogo sem emulador padrão na plataforma
- **WHEN** `games.launch(gameId)` é chamado e a plataforma do jogo não tem emulador padrão
- **THEN** o sistema retorna erro "Nenhum emulador padrão configurado para esta plataforma"

#### Scenario: Executável do emulador não encontrado
- **WHEN** `games.launch(gameId)` é chamado e o caminho do executável não existe no sistema de arquivos
- **THEN** o sistema retorna erro "Executável do emulador não encontrado: <path>"

### Requirement: Botão de lançamento na UI da biblioteca
O sistema SHALL exibir um botão ou ação "Launch" / "Jogar" na grade de jogos para cada jogo. O botão SHALL estar desabilitado quando o jogo não possuir `rom_path` ou a plataforma não tiver emulador padrão configurado.

#### Scenario: Botão habilitado para jogo lançável
- **WHEN** um jogo tem `rom_path` e sua plataforma tem emulador padrão configurado
- **THEN** o botão "Jogar" está habilitado e ao clicar inicia o emulador

#### Scenario: Botão desabilitado sem ROM ou emulador
- **WHEN** um jogo não tem `rom_path` ou a plataforma não tem emulador padrão
- **THEN** o botão "Jogar" está desabilitado com tooltip explicativo
