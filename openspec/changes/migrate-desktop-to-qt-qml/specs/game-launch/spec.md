<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## RENAMED Requirements
- FROM: `### Requirement: Launch via IPC`
- TO: `### Requirement: Launch pelo servico desktop`

## MODIFIED Requirements

### Requirement: Launch pelo servico desktop

A operação de launch por gameId SHALL resolver o emulador padrao da plataforma, preparar o caminho real da ROM e iniciar o processo do emulador.

#### Scenario: Launch com emulador standalone

- **WHEN** o emulador padrao da plataforma nao e RetroArch
- **THEN** o sistema executa o binario com `args` configurados pelo usuario seguidos do caminho da ROM

#### Scenario: Launch com RetroArch

- **WHEN** o emulador padrao e RetroArch
- **THEN** o sistema executa o binario com `-L <corePath> <romPath>`

#### Scenario: ROM compactada

- **WHEN** o jogo aponta para arquivo `.zip` ou `.7z`
- **THEN** o launch extrai a ROM para o cache temporario do app e passa o arquivo extraido ao emulador

#### Scenario: Launch invalido

- **WHEN** o jogo nao possui `rom_path`, nao possui emulador padrao ou nao consegue resolver o executavel/core
- **THEN** o sistema retorna erro e nao inicia processo filho

#### Scenario: Launch bem-sucedido

- **WHEN** o emulador e iniciado sem erro
- **THEN** `launch_count` do jogo e incrementado



