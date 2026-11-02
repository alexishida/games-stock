<!-- Evidências de busca e fallback de metadados (tarefa 7.3). -->
# Busca e metadados alternativos

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `native/src/launchbox/LaunchBoxSearch.*` | Normalização, busca exata/parcial no índice e filtro por plataforma. |
| `native/src/launchbox/OpenVgdb.*` | Download/validação do SQLite OpenVGDB, busca e recuperação de release. |
| `native/src/launchbox/LibretroClient.*` | Listagem de `Named_Boxarts` e normalização de títulos/regiões. |
| `native/src/launchbox/MetadataSearch.*` | Ordem LaunchBox → OpenVGDB → Libretro. |
| `native/src/services/PlatformService.*` | `launchBoxAliases` e `resolvePlatformByLaunchBoxName`. |

## Regras

- A busca LaunchBox remove acentos/pontuação, compara nome e aliases e devolve até 100 jogos:
  correspondências exatas primeiro, depois parciais, ambos em ordem alfabética estável.
- `restrictPlatforms` com lista vazia recusa todos; sem plataforma definida a busca percorre o índice
  inteiro.
- A resolução de plataforma normaliza nome/alias (NFD, sem acentos, minúsculas), testa
  correspondência exata e, para aliases com mais de 4 caracteres, correspondência parcial; o nome
  canônico é fallback.
- OpenVGDB baixa `openvgdb.zip` a partir da API de releases, valida tamanho, URL padrão do GitHub,
  cabeçalho `SQLite format 3` e a tabela `RELEASES`, publicando o arquivo atomicamente.
- A busca OpenVGDB usa o token mais longo, filtra a plataforma mapeada, remove releases cujo título
  não contém toda a consulta, mantém a ficha mais rica por sistema+título e devolve até 30.
- `openvgdb:<id>` recupera a release sem novo download; IDs inválidos/ausentes retornam erro.
- A Libretro consulta `Named_Boxarts`, remove sufixos `(região)` do título, deduplica, limita a 30 e
  coloca o título exato primeiro. Falha de rede devolve lista vazia sem quebrar o fluxo.
- `searchMetadata` só consulta alternativas quando `includeAlternatives` está ativo e a plataforma
  está definida; um resultado LaunchBox exato encerra a busca. OpenVGDB tem prioridade sobre a
  Libretro; a Libretro só fornece título/mídia, sem inventar metadados.

## Evidências

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
$env:GAMESTOCK_7Z_PATH = "$PWD/node_modules/7zip-bin/win/x64/7za.exe"
ctest --test-dir native/build/windows-msvc -C Release -R metadata-search --output-on-failure
```

`metadata-search` cobre:

- exatos/alias antes de parciais, filtro por plataforma, lista vazia bloqueando tudo, limite e
  acentos no LaunchBox;
- aliases semeados (`SNES`, `Nintendo Entertainment System`) e plataforma inexistente;
- listagem Libretro com regiões duplicadas, ordenação exata e erro HTTP;
- OpenVGDB com SQLite fixture: download, extração, uma requisição por API/ZIP, deduplicação por
  riqueza, filtro de sistema, release e ID inválido;
- HTTP 500 e ZIP sem SQLite sem publicar banco inválido;
- fallback combinado: LaunchBox exato não chama alternativas, OpenVGDB assume quando o índice não
  tem resultado e Libretro é o último recurso.

## Limitações / pendências

- Download de imagens, `cover.jpg` e prioridade regional pertencem à tarefa 7.4.
- A UI do importador e o NotificationCenter pertencem à tarefa 7.6.
- `allowCustomAssetUrl` existe para servidores de teste; produção usa a URL fixa do GitHub.
