## MODIFIED Requirements

### Requirement: Banco de dados SQLite inicializado no startup

O sistema SHALL criar ou abrir o banco SQLite em um diretório de dados do usuário específico da plataforma durante o startup do processo main. O caminho padrão SHALL ser `%APPDATA%/gamestock/gamestock.db` no Windows, `~/Library/Application Support/gamestock/gamestock.db` no macOS e `$XDG_DATA_HOME/gamestock/gamestock.db` ou `~/.local/share/gamestock/gamestock.db` no Linux. Quando `GAMESTOCK_USER_DATA_DIR` estiver definida, ela SHALL sobrescrever o diretório padrão em qualquer plataforma. O schema SHALL ser aplicado por migrações idempotentes na inicialização.

#### Scenario: Primeiro uso

- **WHEN** o app é aberto pela primeira vez
- **THEN** o arquivo `gamestock.db` é criado no diretório de dados da plataforma atual com as tabelas principais do app, incluindo `platforms`, `games`, `platform_launchbox_aliases` e `platform_rom_extensions`, e as plataformas padrão são inseridas com seu catálogo inicial

#### Scenario: Uso subsequente

- **WHEN** o app é aberto com banco existente
- **THEN** o banco é aberto sem recriar tabelas e os dados existentes são preservados

#### Scenario: Primeiro uso no Linux

- **WHEN** o usuário abre o GameStock pela primeira vez em Linux sem `XDG_DATA_HOME`
- **THEN** o app cria `~/.local/share/gamestock/gamestock.db` e usa a mesma raiz para os demais dados persistentes do aplicativo

#### Scenario: Diretório sobrescrito por ambiente

- **WHEN** o app inicia com `GAMESTOCK_USER_DATA_DIR` definida
- **THEN** o banco SQLite e os demais arquivos persistentes são criados dentro do diretório informado, sem usar o path padrão da plataforma
