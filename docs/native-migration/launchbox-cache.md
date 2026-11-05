<!-- Evidências do cache e índice LaunchBox (tarefa 7.2). -->
# Cache e índice do LaunchBox

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `native/src/launchbox/LaunchBoxCache.*` | Download HTTPS com progresso, extração do `Metadata.zip`, cache de 24 h, índice JSON e parser XML incremental. |
| `native/src/app/RomLaunchExtraction.*` | `sevenZipBinaryPath`/`extractArchiveWithSevenZip` reutilizados na extração. |

Caminhos padrão dentro de `launchbox_cache/` (abaixo do perfil do usuário):

- `Metadata.xml` — catálogo extraído e canônico.
- `Metadata.zip.part` — download temporário, removido em sucesso ou falha.
- `index.json` — índice id→jogo persistido e reutilizado entre sessões.

## Regras preservadas

- `ensureMetadata(false)` usa o XML quando a idade é de até 24 h **e** o conteúdo começa com
  `<Game>`; `force` baixa de novo.
- O ZIP atual do LaunchBox contém `Metadata.xml`, `Mame.xml`, `Files.xml` e `Platforms.xml`.
  A extração escolhe explicitamente o `Metadata.xml`; escolher o primeiro XML quebraria a busca
  (o `Files.xml` não tem jogos).
- Um XML recente com o dataset errado (por exemplo, `Files.xml` renomeado) é rejeitado e força
  novo download; se o download falhar, um cache antigo válido continua servindo à busca.
- O download usa `QNetworkAccessManager`, segue redirects, aplica timeout de 60 s, valida HTTP 200 e
  reporta progresso em bytes.
- O XML só substitui o anterior depois de extraído e copiado com `QSaveFile`; erro de rede,
  extração ou cópia mantém o `Metadata.xml` antigo.
- O ZIP temporário é removido após sucesso e também em falha.
- O índice é reconstruído do XML com `QXmlStreamReader` (streaming, sem carregar o XML inteiro) e
  grava jogo, plataforma, data, publisher, gêneros, overview, players, ESRB, cooperativo, nomes
  alternativos e imagens.
- `index.json` é aceito apenas se for objeto não vazio e o primeiro jogo tiver `alternateNames`
  (formato atual); cache inválido/antigo é descartado e reconstruído.
- O índice só é gravado após parse completo; XML inválido ou sem `<Game>` não gera índice parcial
  nem índice vazio.
- Operações concorrentes no mesmo `LaunchBoxCache` são serializadas por mutex recursivo: a segunda
  chamada reutiliza XML/índice recém-gerados sem repetir download.
- `MetadataService` e `MediaSyncService` mantêm um `LaunchBoxCache` compartilhado por sessão
  (`std::shared_ptr`): o índice de ~300 MB é lido do disco uma única vez e reutilizado nas buscas e
  importações seguintes, como o `memoryIndex` do Electron.
- No bootstrap, `metadataExists()` decide sem baixar: se o `Metadata.xml` estiver ausente,
  `ensureMetadataAtStartup()` inicia o job "Baixando base de dados" em segundo plano, sem bloquear
  a janela — o mesmo comportamento do renderer Electron.
- `7za/7z/7zz` segue a mesma busca do launch (`GAMESTOCK_7Z_PATH`, app, `tools/`, `PATH`).

## Evidências

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
$env:GAMESTOCK_7Z_PATH = "$PWD/node_modules/7zip-bin/win/x64/7za.exe"
ctest --test-dir native/build/windows-msvc -C Release -R launchbox-cache --output-on-failure
```

`launchbox-cache` cobre:

- servidor HTTP local entregando ZIP real: download, extração, índice com dois jogos, alias,
  imagem/região, `index.json` e segunda leitura sem novo HTTP;
- cache recente retornando `cached`;
- pacote com `Files.xml`/`Mame.xml`/`Metadata.xml` escolhendo o `Metadata.xml` correto;
- `Metadata.xml` recente com dataset errado rejeitado e baixado de novo;
- XML válido sem `<Game>` falhando sem gravar índice vazio;
- `index.json` corrompido/antigo reconstruído a partir do XML e regravado;
- teste opt-in `realMetadataIfProvided` (`GAMESTOCK_TEST_LAUNCHBOX_XML`) validou o `Metadata.xml`
  real de 518 MB (>10.000 jogos, ~38 s);
- XML inválido falhando sem escrever índice;
- HTTP 500 preservando o `Metadata.xml` anterior e removendo o `.part`;
- dois `buildIndex` simultâneos no mesmo objeto resultando em um único request e dois índices
  válidos.

## Pendências relacionadas

- 7.3: busca/matching e integrações OpenVGDB/libretro.
- 7.4: mídia e previews de capas.
- 7.6: importadores e NotificationCenter usando o índice.
