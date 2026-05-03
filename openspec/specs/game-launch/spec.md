# game-launch - Especificação

## Purpose
Lançamento de jogos da biblioteca diretamente no emulador configurado para a plataforma, com suporte a emuladores standalone e RetroArch.

## Requirements

### Requirement: Lançamento de jogo via IPC
O sistema SHALL expor via `window.gameStockAPI.games` o método `launch(gameId)` que resolve o emulador padrão da plataforma do jogo e spawna o processo. O comando varia por tipo de emulador:
- **Standalone** (`is_retroarch = 0`): `spawn(executable, [...parsedArgs, romPath])`
- **RetroArch** (`is_retroarch = 1`): `spawn(executable, [romPath])`

#### Scenario: Lançar jogo com emulador standalone
- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 0`
- **THEN** o processo é iniciado com `executable [...args, rom_path]` e retorna `{ success: true }`

#### Scenario: Lançar jogo via RetroArch
- **WHEN** `games.launch(gameId)` é chamado e o emulador padrão da plataforma tem `is_retroarch = 1`
- **THEN** o processo é iniciado com `retroarch <rom_path>` e retorna `{ success: true }`

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
O sistema SHALL exibir um botão "Jogar" na grade e na lista de jogos para cada jogo. O botão SHALL estar desabilitado quando o jogo não possuir `rom_path` ou quando a plataforma do jogo não possuir emulador padrão configurado. O botão é visível ao passar o mouse sobre o card/linha.

#### Scenario: Botão habilitado para jogo lançável
- **WHEN** um jogo tem `rom_path`, sua plataforma tem emulador padrão configurado e o usuário passa o mouse sobre o card
- **THEN** o botão "Jogar" fica visível e ao clicar inicia o emulador

#### Scenario: Botão desabilitado sem ROM
- **WHEN** um jogo não tem `rom_path`
- **THEN** o botão "Jogar" está desabilitado com tooltip "ROM não configurada"

#### Scenario: Botão desabilitado sem emulador padrão
- **WHEN** um jogo tem `rom_path`, mas sua plataforma não tem emulador padrão configurado
- **THEN** o botão "Jogar" está desabilitado com tooltip explicando que é necessário escolher um emulador padrão para a plataforma

#### Scenario: Erro de lançamento exibido inline
- **WHEN** `games.launch(gameId)` retorna erro
- **THEN** a mensagem de erro é exibida temporariamente sobre o card por 4 segundos

### Requirement: Botão de lançamento no detalhe do jogo
O sistema SHALL exibir no GameDetail uma ação "Jogar" que usa `window.gameStockAPI.games.launch(gameId)` para abrir o emulador padrão da plataforma junto com a ROM do jogo. A ação SHALL estar desabilitada quando o jogo não possuir `rom_path` ou quando a plataforma do jogo não possuir emulador padrão configurado.

#### Scenario: Lançar pelo detalhe do jogo
- **WHEN** o usuário clica em "Jogar" no GameDetail de um jogo com `rom_path` e emulador padrão configurado
- **THEN** o sistema chama `games.launch(gameId)` e inicia o emulador com o jogo

#### Scenario: Detail desabilitado sem emulador padrão
- **WHEN** o GameDetail exibe um jogo com `rom_path`, mas sua plataforma não tem emulador padrão configurado
- **THEN** a ação "Jogar" fica desabilitada

#### Scenario: Erro de lançamento exibido no detalhe
- **WHEN** `games.launch(gameId)` retorna erro após clique no GameDetail
- **THEN** a mensagem de erro é exibida temporariamente próxima à ação "Jogar"
