# rom-association - Especificação

## Purpose
Define associação, remoção e descoberta de arquivos ROM ligados aos jogos da biblioteca.

## Requirements
### Requirement: Associar arquivo ROM a um jogo
O sistema SHALL permitir associar um arquivo ROM a um jogo via diálogo nativo. O caminho absoluto SHALL ser salvo em `games.rom_path`. Formatos aceitos incluem `.zip`, `.rom`, `.bin`, `.iso`, `.img`, `.cue`, `.nes`, `.snes`, `.smd`, `.md`, `.n64`, `.z64`, `.v64`, `.gb`, `.gbc` e `.gba`.

#### Scenario: Selecionar arquivo ROM
- **WHEN** o usuário clica em "Associar ROM"
- **THEN** um diálogo nativo filtrado por formatos suportados é exibido

#### Scenario: ROM associada com sucesso
- **WHEN** o usuário seleciona um arquivo válido
- **THEN** `games.rom_path` é atualizado e um ícone de ROM aparece no card

#### Scenario: Cancelar seleção
- **WHEN** o usuário fecha o diálogo sem selecionar arquivo
- **THEN** `rom_path` permanece inalterado

### Requirement: Remover associação de ROM
O sistema SHALL permitir remover a associação de ROM, definindo `rom_path` como null imediatamente.

#### Scenario: Remover ROM
- **WHEN** o usuário clica em "Remover ROM"
- **THEN** `rom_path` é definido como null, a biblioteca é atualizada e o ícone desaparece

#### Scenario: Cancelar remoção de ROM
- **WHEN** o usuário inicia a remoção mas cancela a confirmação
- **THEN** `rom_path` permanece inalterado

### Requirement: Importar box art
O sistema SHALL permitir importar imagem de capa via diálogo nativo. A imagem SHALL ser copiada para `%APPDATA%/GameStock/images/` e o caminho salvo em `games.box_art_path`.

#### Scenario: Importar imagem de capa
- **WHEN** o usuário clica em "Importar Box Art"
- **THEN** um diálogo nativo filtrado por imagens é exibido

#### Scenario: Imagem copiada localmente
- **WHEN** o usuário seleciona uma imagem
- **THEN** a imagem é copiada para o diretório de dados do app e exibida imediatamente

### Requirement: Associar caminhos de ROM durante importação por pasta
O sistema SHALL associar cada jogo importado ao caminho absoluto da ROM descoberta na pasta selecionada.

#### Scenario: Salvar caminho da ROM para jogo importado
- **WHEN** uma ROM é importada como jogo novo ou atualizado
- **THEN** o registro salva o caminho absoluto em `games.rom_path`

#### Scenario: Preservar caminho de ROM para candidato sem match
- **WHEN** um candidato de ROM não encontra correspondência e nenhum jogo é criado
- **THEN** o caminho da ROM é incluído nos resultados para revisão do usuário

### Requirement: Escaneamento de extensões ROM suportadas
O sistema SHALL usar a mesma política de extensões suportadas para escanear pastas e associar ROMs individuais.

#### Scenario: Escanear extensões aceitas
- **WHEN** uma pasta contém arquivos com extensões ROM suportadas
- **THEN** esses arquivos são elegíveis para descoberta de importação por pasta

#### Scenario: Ignorar extensões não suportadas
- **WHEN** uma pasta contém arquivos como `.txt`, `.jpg` ou `.xml`
- **THEN** esses arquivos não são importados como candidatos de ROM
