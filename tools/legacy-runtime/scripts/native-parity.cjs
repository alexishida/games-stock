/**
 * Gera o inventário rastreável da migração usando a AST real do preload.
 * Executar com --check verifica se a documentação ainda corresponde ao código.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

/** Caminhos fixos evitam consultar qualquer perfil ou dado pessoal do usuário. */
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/native-migration/parity.md');

/** Destinos propostos e critérios de paridade por fronteira funcional. */
const domains = {
  games: ['LibraryService / GameListModel', 'Mesmos filtros, totais, variantes, validações, estado de coleção e histórico.'],
  emulators: ['EmulatorService / EmulatorListModel', 'CRUD, vínculos em lote, core manual/fallback, PATH e padrão único por plataforma.'],
  platforms: ['PlatformService / PlatformListModel', 'Contagens, aliases, extensões, nomes únicos e bloqueios de exclusão.'],
  dialogs: ['NativeDialogService', 'Cancelamento sem efeitos, filtros por SO e caminhos com espaços/acentos.'],
  shell: ['DesktopShellService', 'Abrir destino válido no aplicativo padrão, apresentando erros acionáveis.'],
  app: ['ApplicationService / LogListModel', 'Mesma versão, diretório, estatísticas, logs e limpeza exclusiva do cache de ROM.'],
  updater: ['UpdateService / UpdateState', 'Estado atual observável, offline, timeout, busca manual e identidade do canal.'],
  appState: ['AppStateService', 'JSON legado tolerante, operações em lote e onlyIfMissing sem sobrescrever dados.'],
  dataPortability: ['BackupService / JobListModel', 'Cinco categorias, preview, ZIP64, matching estável e rollback banco/mídia.'],
  launchbox: ['MetadataService / MetadataSearchModel', 'LaunchBox/OpenVGDB/libretro, cache, prioridade regional e progresso observável.'],
  romFolderImport: ['RomImportService / RomCandidateModel / JobListModel', 'Scan/revisão, subpastas, ambiguidades, sync incremental e preservação das ROMs físicas.'],
  view: ['NavigationState', 'Preferências de biblioteca e inventário independentes.'],
  hardwareInventory: ['InventoryService / HardwareItemListModel', 'CRUD, multiplataforma, tipos/estados, filtros, fotos e ordem da galeria.'],
  library: ['NavigationState', 'Ações de criar jogo, abrir plataformas e ordenar sem depender de IPC.']
};

/** Estado verificável por domínio; nomes citam os testes que comprovam a entrega atual. */
const evidence = [
  ['games', 'Implementado', '`GameService`/`GameListModel`, `LaunchService` e `MediaSyncService`; `game-service`, `launch-service` e `media-sync` cobrem CRUD, filtros, variantes, argumentos, extração, `syncCovers` e contagem. Telas `GameDetailPage`/`GameFormDialog`/`GameVersionDialog` e capturas da matriz.'],
  ['emulators', 'Implementado', '`EmulatorService`/`EmulatorListModel` e DAOs; `emulator-service` cobre CRUD, vínculos, padrão único, PATH/caminhos e cores. Telas `EmulatorManager`/`EmulatorFormDialog`/`EmulatorLinkDialog`/`RetroArchCoresDialog`; QML `EmulatorSettings`.'],
  ['platforms', 'Implementado', '`PlatformService`/`PlatformListModel`; `platform-service` cobre CRUD, bloqueios e vínculos. QML `PlatformManager`/`PlatformFormDialog`/`PlatformMappingsDialog`.'],
  ['dialogs', 'Implementado', '`NativeDialogService` é substituído pelos `FileDialog`/`FolderDialog` nativos do Qt; formulários de jogo, emulador, inventário, ROM e backup usam seletores do sistema sem expor caminhos arbitrários ao QML.'],
  ['shell', 'Implementado', '`SettingsService::openDataDir`/`openLogsFolder` usa `QDesktopServices`; links de mídia passam pelo provider `profilemedia` restrito ao perfil.'],
  ['app', 'Implementado', '`SettingsService` cobre logs persistidos, estatísticas do perfil, abertura de pastas e limpeza do cache de ROMs; `ChannelIdentity` detecta/persiste instalado/portátil em `app_state`; QML `LogsSettings`/`AboutSettings` e `HardwareInventory.test_07_logsAndAbout`. Atualização manual está em Sobre, coberta por `test_10_updateSplashAndManualCheck`.'],
  ['updater', 'Implementado', '`UpdateService`/`UpdateManifest`/`UpdateSignature` com feed `latest.json` do GitHub, ECDSA P-256 (BCrypt), SHA-256/tamanho, download em streaming, timeout/offline e aplicação só após validação; `update-service` cobre adulteração/hash/tamanho/timeout/portátil. Splash `SplashOverlay` e busca manual em Sobre; `native-sign-update.ps1` assina localmente. Publicação externa continua manual.'],
  ['appState', 'Implementado', 'DAOs e stores de `app_state`, `LibraryFilterStore`, `FolderStateStore`, `JobStateStore`, `JobRegistry`/`JobManager`/`JobWorker`; `job-registry`, `job-manager` e `rom-folder` cobrem transições, workers, fechamento, dispensa persistida, restauração e lote de 1.200 ROMs com apenas 2 gravações. Chaves `lastRomImportJob` e `lastMediaSyncJobs` são roteadas por tipo de job.'],
  ['dataPortability', 'Implementado', '`ZipArchive`/`PortableManifest`/`CompatibleZipWriter` sobre libarchive 3.8.11 + zlib; `PortabilityDao`, `BackupService` e `BackupCoordinator`; testes `portable-archive`, `backup-service` e `backup-coordinator` cobrem ZIP64/STORED/DEFLATED, cinco categorias, matching, staging/rollback, traversal/symlink, jobs e fixture Electron. Script `native-backup-compat.cjs` comprova exportação Qt importada pelo Electron. UI `DataPortabilitySettings` e captura comparativa.'],
  ['launchbox', 'Implementado', '`LaunchBoxCache`, `LaunchBoxSearch`, `OpenVgdb`, `LibretroClient`, `LibretroMedia`, `MetadataSearch`, `LaunchBoxMedia`, `MetadataService` e `MediaSyncService`; `launchbox-cache`/`metadata-search`/`launchbox-media`/`libretro-media`/`metadata-service`/`media-sync` cobrem cache, busca, fallbacks, importação, região, orientação e JPEG 85. UI `LaunchBoxImporter`/`CoverSyncSettings`; QML `RomFolderImporter` cobre busca/importação.'],
  ['romFolderImport', 'Implementado', '`RomFolderScanner`, `RomFolderService`, `RomFolderDao`, `FolderStateStore` e `NotificationCenter`; `rom-folder` cobre scan manual/automático, subpastas, ambiguidades, placeholders idempotentes, variantes, job em background, restauração interrompida, dispensa persistida e remoção sem apagar arquivos. QML `RomFolderImporter`/`NotificationCenter` cobre revisão, retomada e resumo; perfis TeknoParrot são tratados pela migration `teknoparrot-profile-filename-v1`.'],
  ['view', 'Implementado', '`LibraryFilterStore` persiste visualização/busca/ordenação da biblioteca; `InventoryPreferences` mantém estado próprio e a tela 8.2 confirma a alternância isolada. `view-state` comprova o isolamento e QML `HardwareInventory.test_03_viewMode` alterna cards/lista.'],
  ['hardwareInventory', 'Implementado', '`InventoryService`/`HardwareItemListModel` e DAOs de itens, tipos, estados e fotos; `hardware-inventory` cobre multiplataforma, filtros combinados, ordenação, paginação de 36, fotos (cópia, capa, reordenação, exclusão) e catálogos. QML `HardwareInventoryPage`/`HardwareItemCard`/`InventoryListLine`/`HardwareItemDetailPage`/`HardwareItemFormDialog`; QML `HardwareInventory` cobre sidebar, busca, CRUD e detalhe.'],
  ['library', 'Implementado', '`GameDetailPage`, `GameFormDialog`, `GameMetadataEditor`, `ConfirmDialog` e `GameVersionDialog`; QML `LibraryDetail` cobre detalhe, edição, exclusão, favorito/status e versões. Capturas comparativas na matriz de paridade.']
];

/** Lê os membros declarados, sem executar o preload ou remover seus tipos. */
function apiInventory() {
  const file = ts.createSourceFile('preload.ts', fs.readFileSync(path.join(root, 'src/preload/index.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  let api;
  /** Localiza a única declaração da fachada pública usada pelo renderer. */
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'api') api = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(api && ts.isObjectLiteralExpression(api), 'Fachada api não encontrada.');
  return api.properties.flatMap((group) => {
    const namespace = group.name.getText(file);
    assert.ok(domains[namespace], `Domínio sem destino: ${namespace}`);
    assert.ok(ts.isObjectLiteralExpression(group.initializer));
    return group.initializer.properties.map((member) => {
      const name = member.name.getText(file);
      const channel = /IPC_CHANNELS\.([\w.]+)/.exec(member.getText(file));
      assert.ok(channel, `Operação sem canal rastreado: ${namespace}.${name}`);
      const description = (member.jsDoc ?? []).map((doc) => typeof doc.comment === 'string' ? doc.comment : '').join(' ').replace(/\s+/g, ' ').trim();
      return { namespace, name, channel: channel[1], description, line: file.getLineAndCharacterOfPosition(member.getStart(file)).line + 1 };
    });
  });
}

/** Enumera componentes e telas existentes de maneira determinística. */
function rendererFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return rendererFiles(target);
    return entry.name.endsWith('.tsx') ? [path.relative(root, target).replaceAll('\\', '/')] : [];
  }).sort();
}

/** Lista os arquivos QML do runtime nativo para a checagem de fronteira. */
function qmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return qmlFiles(target);
    return entry.name.endsWith('.qml') ? [target] : [];
  });
}

/** Impede que a camada QML volte a carregar SQL ou execução genérica de processos. */
function assertQmlBoundary() {
  const rules = [
    [/\bSELECT\b[\s\S]{0,40}\bFROM\b/i, 'consulta SQL'],
    [/\bINSERT\s+INTO\b/i, 'INSERT SQL'],
    [/\bUPDATE\s+\w+\s+SET\b/i, 'UPDATE SQL'],
    [/\bDELETE\s+FROM\b/i, 'DELETE SQL'],
    [/\bQSql(Query|Database)\b/, 'classe Qt SQL'],
    [/\bQProcess\b/, 'processo externo'],
    [/\bexec\s*\(/, 'execução genérica']
  ];
  for (const file of qmlFiles(path.join(root, 'native/qml'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [pattern, label] of rules) {
      assert.ok(!pattern.test(source), `QML contém ${label}: ${path.relative(root, file)}`);
    }
  }
}

/** Escapa somente os caracteres que interferem nas tabelas Markdown. */
function cell(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/** Produz inventário completo; destinos indicam planejamento, nunca implementação concluída. */
function render() {
  const operations = apiInventory();
  const lines = [
    '<!-- Inventário gerado pela AST; preservar critérios e destinos em scripts/native-parity.cjs. -->',
    '# Matriz de paridade do runtime desktop', '',
    'Gerar: `node scripts/native-parity.cjs`. Conferir: `node scripts/native-parity.cjs --check`.', '',
    `Inventário: **${operations.length} operações/listeners**, **${Object.keys(domains).length} domínios**. Todos os destinos abaixo são propostos; a seção de evidências registra o que já tem implementação e teste nativo.`, '',
    '## Operações e eventos', '',
    '| Origem no preload | Canal lógico | Destino C++/QML | Comportamento e verificação |',
    '|---|---|---|---|'
  ];
  for (const op of operations) {
    const [target, verification] = domains[op.namespace];
    lines.push(`| [${op.namespace}.${op.name}](../../src/preload/index.ts#L${op.line}) | \`${op.channel}\` | ${target} | ${cell(op.description)} ${verification} |`);
  }
  lines.push('', '## Telas e componentes', '', 'Cada origem deve ter comparação de estados normal, vazio, loading e erro quando aplicável; formulários incluem validação, foco e teclado. Modais incluem drag e empilhamento. Componentes repetidos podem compartilhar a implementação QML, mas não perder comportamentos.', '', '| Origem | Destino proposto | Verificação |', '|---|---|---|');
  for (const file of rendererFiles(path.join(root, 'src/renderer'))) {
    const name = path.basename(file, '.tsx');
    const destination = name === 'main' ? 'Bootstrap C++' : `QML ${name}`;
    lines.push(`| [${file}](../../${file}) | ${destination} | Capturas na mesma fixture/resolução/escala; fluxo e estados equivalentes. |`);
  }
  lines.push('', '## Integrações que não podem desaparecer', '',
    '| Origem | Destino | Evidência exigida |', '|---|---|---|',
    '| src/main/db | DAOs/repositórios C++ | Banco populado, migrations idempotentes, paginação e contagens equivalentes. |',
    '| src/main/lib/launchbox | MetadataService | LaunchBox, OpenVGDB, Libretro, cache JSON/XML, fallback e concorrência sem download duplicado. |',
    '| src/main/romLaunchExtraction.ts e executableResolver.ts | LaunchService | ZIP/7z, cache, argumentos, resolução por SO e emulador falso. |',
    '| src/main/romFolderImport.ts e workers | RomFolderService / RomFolderScanner / NotificationCenter | Scan automático/manual, sync incremental, resumos e retomada sem duplicatas. |',
    '| src/main/dataPortability*.ts | BackupService | ZIP64, cinco categorias, preview, restauração cruzada e falha transacional. |',
    '| src/main/appPaths.ts e database.ts | ProfileService | Diretório legado/override, mídias, schema_migrations e app_state preservados. |',
    '| src/main/updater.ts e splash-window.ts | UpdateService / Splash QML | Ponte NSIS, canal instalado/portátil, integridade e timeout/offline. |',
    '| src/renderer/store e lib/appStatePersistence.ts | Estado/modelos observáveis | Jobs visíveis ao montar tela, persistência por transição e migração de localStorage. |',
    '| src/main/logger.ts | LogService | Histórico persistido, mensagens acionáveis e limpeza controlada. |', '',
    '## Evidências de implementação', '',
    'Status por domínio. "Parcial" indica que apenas parte das operações listadas já tem serviço/modelo e teste nativo; o restante continua nas tarefas indicadas na evidência.', '',
    '| Domínio | Estado | Evidência |', '|---|---|---|');
  for (const [domain, status, text] of evidence) {
    lines.push(`| ${domain} | ${status} | ${cell(text)} |`);
  }
  lines.push('', 'A geração também falha se algum arquivo QML contiver SQL, `QSqlQuery`/`QSqlDatabase`, `QProcess` ou execução genérica.', '');
  return lines.join('\n');
}

/** Falha no modo de verificação em vez de reescrever uma referência desatualizada. */
function main() {
  assert.ok(process.argv.slice(2).every((arg) => arg === '--check'), 'Uso: node scripts/native-parity.cjs [--check]');
  assertQmlBoundary();
  const expected = render();
  if (process.argv.includes('--check')) {
    assert.equal(fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), expected, 'Matriz desatualizada; gere novamente.');
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, expected);
  }
  console.log(`Inventário de paridade ${process.argv.includes('--check') ? 'verificado' : 'gerado'}.`);
}

main();
