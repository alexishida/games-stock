# rom-association Specification

## Purpose
TBD - created by archiving change create-game-stock-app. Update Purpose after archive.
## Requirements
### Requirement: Associar arquivo ROM a um jogo
O sistema SHALL permitir associar um arquivo ROM a um jogo via diálogo nativo de seleção de arquivo. O caminho absoluto do arquivo SHALL ser salvo em `games.rom_path`. Formatos aceitos: `.zip`, `.rom`, `.bin`, `.iso`, `.img`, `.cue`, `.nes`, `.snes`, `.smd`, `.md`, `.n64`, `.z64`, `.v64`, `.gb`, `.gbc`, `.gba`.

#### Scenario: Selecionar arquivo ROM
- **WHEN** o usuário clica em "Associar ROM" no detalhe de um jogo
- **THEN** um diálogo nativo de abertura de arquivo é exibido filtrado pelos formatos suportados

#### Scenario: ROM associada com sucesso
- **WHEN** o usuário seleciona um arquivo válido
- **THEN** `games.rom_path` é atualizado com o caminho absoluto e um ícone de ROM aparece no card

#### Scenario: Cancelar seleção
- **WHEN** o usuário fecha o diálogo sem selecionar arquivo
- **THEN** `rom_path` permanece inalterado

### Requirement: Remover associação de ROM
O sistema SHALL permitir remover a associação de ROM de um jogo, definindo `rom_path` como null.

#### Scenario: Remover ROM
- **WHEN** o usuário clica em "Remover ROM" no detalhe de um jogo com ROM associada
- **THEN** `rom_path` é definido como null e o ícone de ROM desaparece do card

### Requirement: Importar box art
O sistema SHALL permitir importar uma imagem de capa para um jogo via diálogo nativo. A imagem SHALL ser copiada para `%APPDATA%/GameStock/images/<id>.<ext>` e o caminho salvo em `games.box_art_path`. Formatos aceitos: `.jpg`, `.jpeg`, `.png`, `.webp`.

#### Scenario: Importar imagem de capa
- **WHEN** o usuário clica em "Importar Box Art" no detalhe de um jogo
- **THEN** um diálogo nativo de abertura de arquivo é exibido filtrado por imagens

#### Scenario: Imagem copiada localmente
- **WHEN** o usuário seleciona uma imagem
- **THEN** a imagem é copiada para o diretório de dados do app e exibida imediatamente no card

