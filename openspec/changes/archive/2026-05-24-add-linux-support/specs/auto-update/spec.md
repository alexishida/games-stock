## MODIFIED Requirements

### Requirement: Verificação de versão via JSON remoto

O sistema SHALL buscar um arquivo JSON em uma URL configurada no build contendo os campos `version`, `buildNumber`, `releaseDate`, `downloadUrl` e `releaseNotes`. A verificação automática no startup SHALL ocorrer apenas em builds Windows empacotadas com suporte a update in-place. Em builds Linux empacotadas, o app SHALL pular download/aplicação automática e seguir para abertura normal da janela principal.

#### Scenario: Versão remota mais nova disponível no Windows

- **WHEN** o app empacotado no Windows inicia e o campo `version` do JSON remoto é maior (semver) que `app.getVersion()` local
- **THEN** o sistema inicia o download do pacote indicado em `downloadUrl`

#### Scenario: App já está na versão mais recente no Windows

- **WHEN** o app empacotado no Windows inicia e o campo `version` do JSON remoto é igual ou menor que a versão local
- **THEN** o sistema não baixa nada e sinaliza à splash que o app está atualizado

#### Scenario: Build Linux empacotada

- **WHEN** o app empacotado no Linux inicia
- **THEN** o sistema não baixa nem aplica update automaticamente e abre o app normalmente com a versão instalada

#### Scenario: Servidor inacessível por falta de conexão

- **WHEN** a requisição ao JSON falha por erro de rede ou timeout (sem conectividade) durante uma verificação automática suportada
- **THEN** o sistema registra o erro em log e emite evento `updater:status` com `{ phase: 'no-connection', error: <mensagem> }` para que a splash exiba o modal de erro com opção offline

#### Scenario: Servidor inacessível por erro de resposta

- **WHEN** a requisição retorna status HTTP diferente de 200 durante uma verificação automática suportada
- **THEN** o sistema registra o erro em log e emite `updater:status` com `{ phase: 'error' }`, sem abrir modal — a splash fecha automaticamente

#### Scenario: JSON inválido ou campos ausentes

- **WHEN** a resposta não contém os campos obrigatórios ou não é JSON válido durante uma verificação automática suportada
- **THEN** o sistema trata como erro de verificação e abre o app normalmente

### Requirement: Download do pacote de atualização

O sistema SHALL baixar o arquivo `.zip` indicado em `downloadUrl` para um diretório temporário do sistema somente quando a plataforma atual suportar update in-place. O progresso do download (bytes recebidos / total) SHALL ser reportado à splash screen via IPC em intervalos regulares.

#### Scenario: Download concluído com sucesso

- **WHEN** um app Windows suportado baixa completamente o arquivo `.zip`
- **THEN** o sistema verifica que o tamanho do arquivo corresponde ao `Content-Length` da resposta e prossegue para a extração

#### Scenario: Download com falha ou arquivo corrompido

- **WHEN** o download é interrompido ou o tamanho final não bate com `Content-Length`
- **THEN** o arquivo temporário é removido, o erro é logado, e o app abre normalmente sem aplicar update

#### Scenario: Progresso reportado

- **WHEN** bytes são recebidos durante o download em uma plataforma suportada
- **THEN** o main envia ao renderer da splash o evento `updater:status` com `{ phase: 'downloading', percent: <0-100> }`

### Requirement: Aplicação do update via staging e relaunch

O sistema SHALL extrair o `.zip` para um diretório de staging (`_update_staging`) ao lado de `process.resourcesPath` apenas em plataformas com update in-place suportado. Ao concluir a extração, o app SHALL relançar com a flag `--apply-update <stagingPath>`. No próximo boot, ao detectar essa flag, o processo main SHALL copiar os arquivos do staging sobre `resourcesPath/app` antes de inicializar normalmente.

#### Scenario: Staging criado e app relançado

- **WHEN** a extração do ZIP conclui sem erro em uma build Windows suportada
- **THEN** o sistema chama `app.relaunch({ args: ['--apply-update', stagingPath] })` seguido de `app.exit(0)`

#### Scenario: Aplicação do update no relaunch

- **WHEN** o app inicia com a flag `--apply-update <stagingPath>` em uma plataforma com update in-place suportado
- **THEN** o processo main copia recursivamente os arquivos de `stagingPath` para `resourcesPath/app`, remove o diretório de staging e continua a inicialização normalmente (com splash de verificação)

#### Scenario: Falha na cópia por permissão

- **WHEN** a cópia dos arquivos de staging falha por erro de permissão ou arquivo em uso
- **THEN** o sistema remove o staging, loga o erro e abre o app com a versão anterior instalada

#### Scenario: Staging ausente no relaunch

- **WHEN** o app inicia com `--apply-update` mas o diretório de staging não existe
- **THEN** o sistema ignora a flag e inicializa normalmente

## ADDED Requirements

### Requirement: Verificação manual em plataformas com update externo

O sistema SHALL permitir que o usuário acione uma checagem manual de atualização em builds Linux para consultar os metadados remotos, mas SHALL apenas informar que a atualização precisa ser feita por pacote externo, sem baixar ZIP nem sobrescrever a instalação local.

#### Scenario: Checagem manual em Linux

- **WHEN** o usuário clica em "Buscar atualização" em uma build Linux
- **THEN** o app consulta o manifesto remoto, informa que a atualização é gerenciada externamente e não inicia download nem relaunch
