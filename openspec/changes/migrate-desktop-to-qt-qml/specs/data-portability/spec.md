<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Categoria romLocations

A categoria `romLocations` SHALL incluir `rom_path` dos jogos e as entradas persistidas do importador de pastas, incluindo `includeSubfolders`.

#### Scenario: Exportar localizacoes sem copiar ROMs

- **WHEN** o usuario exporta `romLocations`
- **THEN** o pacote salva somente caminhos e configuracoes de pastas, sem embutir os arquivos ROM

#### Scenario: Importar localizacoes

- **WHEN** o usuario importa `romLocations`
- **THEN** os `rom_path` sao restaurados nos jogos correspondentes e as entradas de pastas sao persistidas pelo servico de estado do app no SQLite


### Requirement: Jobs em background com progresso

O sistema SHALL executar exportacao e importacao em background, emitindo eventos de progresso e conclusao ao modelo observável da interface nativa.

#### Scenario: Job de portabilidade em andamento

- **WHEN** uma exportacao ou importacao esta rodando
- **THEN** o NotificationCenter exibe card com etapa atual, barra de progresso e status final

#### Scenario: Job interrompido entre sessoes

- **WHEN** o app reinicia e encontra job persistido com `status: "running"`
- **THEN** esse job e reclassificado como `interrupted`

