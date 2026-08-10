# game-launch Specification

## Purpose
Lancar jogos da biblioteca diretamente no emulador configurado para a plataforma, com suporte a variantes, RetroArch e ROMs compactadas.

## Requirements
### Requirement: Launch via IPC

O metodo `window.gameStockAPI.games.launch(gameId)` SHALL resolver o emulador padrao da plataforma, preparar o caminho real da ROM e iniciar o processo do emulador.

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

### Requirement: Selecao de versao antes do launch

O fluxo de UI SHALL consultar `games.listVersions(gameId)` antes do launch efetivo.

#### Scenario: Apenas uma versao jogavel

- **WHEN** `listVersions()` retorna zero ou uma variante jogavel
- **THEN** a UI dispara `games.launch()` diretamente para essa variante

#### Scenario: Multiplas variantes jogaveis

- **WHEN** `listVersions()` retorna mais de uma variante relacionada
- **THEN** a UI abre `GameVersionModal` para o usuario escolher qual ROM iniciar

### Requirement: Controles de launch na biblioteca

Grade, lista e detalhe SHALL expor a acao `Jogar`, mas com heuristicas de habilitacao coerentes com cada tela.

#### Scenario: Card da grade

- **WHEN** o jogo tem ROM e a plataforma tem emulador padrao carregado
- **THEN** o botao do card fica habilitado

#### Scenario: Linha da lista

- **WHEN** o jogo possui `rom_path`
- **THEN** a linha permite tentar launch, mesmo que a falta de emulador padrao so seja descoberta ao chamar a API

#### Scenario: Painel de detalhe

- **WHEN** o jogo possui ROM e emulador padrao resolvido
- **THEN** o botao `Jogar` do detalhe fica habilitado

#### Scenario: Erro de launch na UI

- **WHEN** o launch falha em grade, lista ou detalhe
- **THEN** a tela correspondente mostra a mensagem de erro de forma temporaria
