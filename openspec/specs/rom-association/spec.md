# rom-association - Especificação

## Purpose
Define associação, remoção e descoberta de arquivos ROM e imagens de capa ligados aos jogos da biblioteca.

## Requirements
### Requirement: Associar arquivo ROM a um jogo
O sistema SHALL permitir associar um arquivo ROM a um jogo via diálogo nativo acessível pelo GameForm. O caminho absoluto SHALL ser salvo em `games.rom_path`. Formatos aceitos incluem `.zip`, `.rom`, `.bin`, `.iso`, `.img`, `.cue`, `.nes`, `.snes`, `.sfc`, `.smc`, `.swc`, `.fig`, `.smd`, `.md`, `.n64`, `.z64`, `.v64`, `.gb`, `.gbc` e `.gba`.

#### Scenario: Selecionar arquivo ROM
- **WHEN** o usuário clica em "Associar ROM" no GameForm
- **THEN** o canal `dialogs:openRomFile` abre um diálogo nativo filtrado pelos formatos suportados

#### Scenario: ROM associada com sucesso
- **WHEN** o usuário seleciona um arquivo válido
- **THEN** `games.rom_path` é atualizado e o botão "Abrir ROM" no GameDetail fica habilitado

#### Scenario: Cancelar seleção
- **WHEN** o usuário fecha o diálogo sem selecionar arquivo
- **THEN** `rom_path` permanece inalterado

### Requirement: Abrir ROM pelo GameDetail
O sistema SHALL permitir abrir o arquivo ROM associado no explorador do sistema operacional a partir do GameDetail.

#### Scenario: Abrir ROM existente
- **WHEN** o usuário clica em "Abrir ROM" e o jogo tem `rom_path` válido
- **THEN** o canal `shell:openPath` abre o caminho no explorador do SO

#### Scenario: Botão desabilitado sem ROM
- **WHEN** `rom_path` é null
- **THEN** o botão "Abrir ROM" está desabilitado

### Requirement: Remover associação de ROM
O sistema SHALL permitir remover a associação de ROM, definindo `rom_path` como null após confirmação.

#### Scenario: Remover ROM
- **WHEN** o usuário clica em "Remover ROM" no GameForm e confirma
- **THEN** `rom_path` é definido como null e o botão "Abrir ROM" fica desabilitado

#### Scenario: Botão remover desabilitado sem ROM
- **WHEN** `rom_path` é null
- **THEN** o botão "Remover ROM" está desabilitado

### Requirement: Importar box art manualmente
O sistema SHALL permitir importar imagem de capa via diálogo nativo pelo GameForm. A imagem SHALL ser copiada para `%APPDATA%/GameStock/images/` via canal `dialogs:openImageFile` e o caminho salvo em `games.box_art_path`.

#### Scenario: Importar imagem de capa
- **WHEN** o usuário clica em "Importar Box Art" no GameForm
- **THEN** o canal `dialogs:openImageFile` abre diálogo filtrado por .jpg, .jpeg, .png e .webp

#### Scenario: Imagem copiada localmente
- **WHEN** o usuário seleciona uma imagem
- **THEN** a imagem é copiada para o diretório de dados do app, `box_art_path` é atualizado e a capa é exibida imediatamente no GameDetail

### Requirement: Associar caminhos de ROM durante importação por pasta
O sistema SHALL associar cada jogo importado ao caminho absoluto da ROM descoberta na pasta selecionada.

#### Scenario: Salvar caminho da ROM para jogo importado
- **WHEN** uma ROM é importada como jogo novo ou atualizado
- **THEN** o registro salva o caminho absoluto em `games.rom_path`

#### Scenario: Preservar caminho de ROM para candidato sem match
- **WHEN** um candidato de ROM não encontra correspondência e nenhum jogo é criado
- **THEN** o caminho da ROM é incluído no resultado para referência no resumo

### Requirement: Política de extensões ROM suportadas
O sistema SHALL usar a mesma lista de extensões suportadas para o diálogo de associação manual e para o escaneamento de pastas de ROMs.

#### Scenario: Escanear extensões aceitas
- **WHEN** uma pasta contém arquivos com extensões ROM suportadas
- **THEN** esses arquivos são elegíveis para descoberta de importação por pasta

#### Scenario: Ignorar extensões não suportadas
- **WHEN** uma pasta contém arquivos como `.txt`, `.jpg` ou `.xml`
- **THEN** esses arquivos não são importados como candidatos de ROM
