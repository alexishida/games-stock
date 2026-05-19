# auto-update Specification

## Purpose
TBD - created by archiving change auto-updater. Update Purpose after archive.
## Requirements
### Requirement: Verificação de versão via JSON remoto

O sistema SHALL buscar um arquivo JSON em uma URL configurada no build contendo os campos `version`, `buildNumber`, `releaseDate`, `downloadUrl` e `releaseNotes`. A verificação SHALL ocorrer no processo main durante a inicialização, com timeout máximo de 5 segundos.

#### Scenario: Versão remota mais nova disponível

- **WHEN** o campo `version` do JSON remoto é maior (semver) que `app.getVersion()` local
- **THEN** o sistema inicia o download do pacote indicado em `downloadUrl`

#### Scenario: App já está na versão mais recente

- **WHEN** o campo `version` do JSON remoto é igual ou menor que a versão local
- **THEN** o sistema não baixa nada e sinaliza à splash que o app está atualizado

#### Scenario: Servidor inacessível por falta de conexão

- **WHEN** a requisição ao JSON falha por erro de rede ou timeout (sem conectividade)
- **THEN** o sistema registra o erro em log e emite evento `updater:status` com `{ phase: 'no-connection', error: <mensagem> }` para que a splash exiba o modal de erro com opção offline

#### Scenario: Servidor inacessível por erro de resposta

- **WHEN** a requisição retorna status HTTP diferente de 200 (servidor fora, endpoint errado)
- **THEN** o sistema registra o erro em log e emite `updater:status` com `{ phase: 'error' }`, sem abrir modal — a splash fecha automaticamente

#### Scenario: JSON inválido ou campos ausentes

- **WHEN** a resposta não contém os campos obrigatórios ou não é JSON válido
- **THEN** o sistema trata como erro de verificação e abre o app normalmente

### Requirement: Download do pacote de atualização

O sistema SHALL baixar o arquivo `.zip` indicado em `downloadUrl` para um diretório temporário do sistema. O progresso do download (bytes recebidos / total) SHALL ser reportado à splash screen via IPC em intervalos regulares.

#### Scenario: Download concluído com sucesso

- **WHEN** o arquivo `.zip` é baixado completamente
- **THEN** o sistema verifica que o tamanho do arquivo corresponde ao `Content-Length` da resposta e prossegue para a extração

#### Scenario: Download com falha ou arquivo corrompido

- **WHEN** o download é interrompido ou o tamanho final não bate com `Content-Length`
- **THEN** o arquivo temporário é removido, o erro é logado, e o app abre normalmente sem aplicar update

#### Scenario: Progresso reportado

- **WHEN** bytes são recebidos durante o download
- **THEN** o main envia ao renderer da splash o evento `updater:status` com `{ phase: 'downloading', percent: <0-100> }`

### Requirement: Aplicação do update via staging e relaunch

O sistema SHALL extrair o `.zip` para um diretório de staging (`_update_staging`) ao lado de `process.resourcesPath`. Ao concluir a extração, o app SHALL relançar com a flag `--apply-update <stagingPath>`. No próximo boot, ao detectar essa flag, o processo main SHALL copiar os arquivos do staging sobre `resourcesPath/app` antes de inicializar normalmente.

#### Scenario: Staging criado e app relançado

- **WHEN** a extração do ZIP conclui sem erro
- **THEN** o sistema chama `app.relaunch({ args: ['--apply-update', stagingPath] })` seguido de `app.exit(0)`

#### Scenario: Aplicação do update no relaunch

- **WHEN** o app inicia com a flag `--apply-update <stagingPath>`
- **THEN** o processo main copia recursivamente os arquivos de `stagingPath` para `resourcesPath/app`, remove o diretório de staging e continua a inicialização normalmente (com splash de verificação)

#### Scenario: Falha na cópia por permissão

- **WHEN** a cópia dos arquivos de staging falha por erro de permissão ou arquivo em uso
- **THEN** o sistema remove o staging, loga o erro e abre o app com a versão anterior instalada

#### Scenario: Staging ausente no relaunch

- **WHEN** o app inicia com `--apply-update` mas o diretório de staging não existe
- **THEN** o sistema ignora a flag e inicializa normalmente

### Requirement: Configuração da URL de update por build

O sistema SHALL ler a URL do JSON de metadados de uma constante definida em tempo de build (`src/shared/update-config.ts`), substituível via `define` no `vite.config`. Nenhuma URL de servidor de update deverá estar hardcoded em múltiplos lugares.

#### Scenario: URL configurada no build

- **WHEN** o app é empacotado com `UPDATE_MANIFEST_URL` definida
- **THEN** todas as verificações de update usam essa URL sem necessidade de recompilar outros módulos

#### Scenario: URL ausente (desenvolvimento local)

- **WHEN** `UPDATE_MANIFEST_URL` não está definida (ambiente de dev)
- **THEN** o sistema pula a verificação de update e abre o app diretamente, sem exibir a splash

