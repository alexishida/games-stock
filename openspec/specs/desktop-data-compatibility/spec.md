<!-- Contrato atual consolidado da implementação nativa; histórico preservado em changes/. -->
# desktop-data-compatibility Specification

## Purpose

Garantir que a troca do runtime desktop preserve os dados, as configurações e os backups de instalações existentes, com recuperação segura em caso de falha.

## Requirements

### Requirement: Reutilizacao do perfil existente

O sistema SHALL reutilizar o diretório e banco existentes, respeitar `GAMESTOCK_USER_DATA_DIR` e preservar jogos, variantes, plataformas, emuladores, inventário, mídias, pastas, histórico e migrations aplicadas, sem exigir reimportação.

#### Scenario: Instalação populada
- **WHEN** a nova versão abre um perfil populado por uma versão anterior
- **THEN** as entidades, relacionamentos e arquivos continuam disponíveis, sem recriação ou duplicação da biblioteca

#### Scenario: Diretório customizado
- **WHEN** `GAMESTOCK_USER_DATA_DIR` aponta para um perfil existente
- **THEN** esse perfil é aberto em vez de criar uma biblioteca no diretório padrão

### Requirement: Migracao segura e idempotente

O sistema SHALL aplicar somente migrations pendentes de forma transacional, preservar campos legados com defaults e criar snapshot SQLite consistente antes de novas migrations. Falha de snapshot ou incompatibilidade SHALL impedir alterações no perfil.

#### Scenario: Reabertura após migration
- **WHEN** um perfil já migrado é reaberto
- **THEN** migrations e seeds não duplicam nem sobrescrevem dados do usuário

#### Scenario: Falha na atualização de schema
- **WHEN** uma migration falha
- **THEN** a transação é revertida, o snapshot permanece disponível e o erro é apresentado sem criar um banco alternativo vazio

#### Scenario: Schema futuro
- **WHEN** o banco exige uma versão de schema desconhecida
- **THEN** a abertura para escrita é recusada e o banco permanece intacto

### Requirement: Compatibilidade de backup entre runtimes

O sistema SHALL ler e gerar `.gamestock-backup` schemaVersion 1 compatível com a versão anterior, incluindo ZIP64 e categorias `metadata`, `images`, `platforms`, `romLocations` e `inventoryImages`, com os mesmos critérios de matching e rollback.

#### Scenario: Restauração cruzada
- **WHEN** um backup válido é exportado por qualquer uma das duas implementações e importado pela outra
- **THEN** categorias, vínculos e mídias são restaurados no perfil de destino sem copiar ROMs físicas ou depender de IDs brutos do pacote

#### Scenario: Falha na restauração de mídia
- **WHEN** uma importação falha após copiar arquivos
- **THEN** alterações no banco e arquivos da operação são revertidos sem apagar mídias preexistentes

### Requirement: Continuidade do estado de jobs

O sistema SHALL recuperar jobs e pastas de `app_state`, interpretar campos ausentes com defaults e marcar jobs `running` herdados como `interrupted`. Persistência de progresso SHALL ocorrer apenas nas transições de início, conclusão, falha e dispensa.

#### Scenario: Reabrir após interrupção
- **WHEN** existe um job persistido como `running`
- **THEN** ele aparece como interrompido e permite a retomada suportada sem duplicar registros

#### Scenario: Progresso frequente
- **WHEN** um job publica vários ticks de progresso
- **THEN** a UI reflete os ticks sem gravação SQLite a cada tick

### Requirement: Exclusao mutua e retorno de versao

O sistema SHALL impedir acesso simultâneo do runtime antigo e novo ao mesmo perfil durante a transição. Retorno a uma versão incompatível SHALL exigir recuperação explícita de snapshot, sem sobrescrever silenciosamente alterações posteriores.

#### Scenario: Perfil em uso
- **WHEN** a outra implementação está usando o mesmo perfil
- **THEN** a nova abertura é bloqueada com orientação para encerrar a instância anterior

#### Scenario: Retorno com schema incompatível
- **WHEN** uma versão anterior não pode abrir o schema atual
- **THEN** o fluxo de recuperação informa o snapshot e a perda das alterações posteriores antes de qualquer restauração

### Requirement: Recuperacao de configuracoes legadas

O sistema SHALL ler configurações legadas já persistidas em SQLite/app_state, tolerando campos ausentes. O runtime Qt não SHALL depender de Chromium/LevelDB para abrir o perfil; migração direta de localStorage e ponte Electron não fazem parte da distribuição atual.

#### Scenario: Entradas legadas de pastas
- **WHEN** app_state contém entradas antigas de pastas sem includeSubfolders
- **THEN** o app as apresenta preservando os caminhos e assumindo includeSubfolders = false

