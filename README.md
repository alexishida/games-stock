# GameStock

GameStock e um aplicativo desktop para Windows para organizar bibliotecas de jogos retro, ROMs, capas, metadados e inventario fisico. O app roda com Electron, React, TypeScript, Vite e SQLite local via `better-sqlite3`.

![Biblioteca principal](screenshot/principal.jpg)

![Detalhe do jogo](screenshot/game-detail.jpg)

## Funcionalidades

- **Biblioteca de jogos**: crie, edite, exclua e consulte jogos com titulo, plataforma, publisher, ano, genero, classificacao, notas, favorito e status de jogo.
- **Grade e lista**: navegue por cards com capas ou por uma lista compacta, com paginacao, ordenacao e navegacao por teclado.
- **Detalhe do jogo**: veja capa, background, screenshot, metadados, caminho da ROM e formulario de edicao em uma tela dedicada.
- **Importacao de metadados no formulario**: busque e importe metadados da LaunchBox diretamente pelo formulario de edicao do jogo.
- **Filtros de colecao**: filtre por todos, favoritos, jogando, concluidos e nao jogados.
- **Busca e plataformas**: pesquise por titulo e navegue pela sidebar com plataformas agrupadas por categoria.
- **Gerenciador de plataformas**: cadastre, edite e remova plataformas; configure aliases LaunchBox para correspondencia de metadados e extensoes de ROM aceitas por plataforma.
- **Gerenciador de emuladores**: cadastre emuladores por plataforma, defina o emulador padrao e lance jogos diretamente pela tela de detalhe.
- **Integracao RetroArch**: detecte cores instalados, configure o core padrao por plataforma e lance jogos com o core correto automaticamente.
- **Cadastro manual**: adicione jogos sem depender da LaunchBox.
- **Associacao de ROMs**: selecione arquivos ROM por dialogos nativos do sistema.
- **Importador LaunchBox**: baixe/cacheie metadados publicos, pesquise jogos, escolha tipos de imagem e importe metadados + midias.
- **Importacao por pasta de ROMs**: escaneie pastas ou arquivos, revise candidatos, rode importacao em background e acompanhe progresso. Suporta busca em subpastas e deteccao automatica de plataforma por extensao de ROM.
- **Sincronizacao de capas**: atualize midias de jogos vinculados a LaunchBox, acompanhe multiplos jobs simultaneos e veja estatisticas de capas.
- **Notificacoes de jobs**: acompanhe downloads e importacoes em background pela UI. Jobs concluidos ficam visiveis ate serem dispensados manualmente.
- **Resiliencia de jobs**: jobs interrompidos por fechamento do app sao detectados na proxima abertura e exibem botao de retomada. Cards de job tem borda colorida por status (azul=rodando, verde=concluido, vermelho=falhou, amarelo=interrompido).
- **Dados locais**: banco, imagens, cache e estado de janela ficam no disco local em `%APPDATA%/gamestock/`.

## Requisitos

- Windows 11
- Node.js 18 ou superior
- npm

## Instalacao

```bash
npm install
```

O `postinstall` executa `electron-builder install-app-deps` para recompilar modulos nativos, como `better-sqlite3`, contra o runtime do Electron usado pelo projeto.

## Desenvolvimento

```bash
npm run dev:windows
```

Esse comando inicia o Vite em `127.0.0.1:5173`, compila `main` e `preload` em modo watch, espera os artefatos em `dist/` e abre o Electron.

Se `ELECTRON_RUN_AS_NODE` estiver definido no shell, limpe antes de iniciar o Electron manualmente:

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
```

## Build

Compilar o renderer:

```bash
npm run build:renderer
```

Compilar o processo main e o preload:

```bash
npm run build:main
```

Gerar instalador NSIS e build portatil do Windows em `release/`:

```bash
npm run dist:windows
```

## Versao do App

A versao base do aplicativo fica em `package.json`, no campo `version`.

Exemplo:

```json
"version": "0.1.0"
```

O numero do build e gerado automaticamente a partir do commit atual com `git rev-parse --short=7 HEAD`.

Antes de `npm run dev:windows`, `npm run build:renderer`, `npm run build:main` e `npm run dist:windows`, o projeto executa `npm run sync:build-meta`, que atualiza o arquivo gerado `src/shared/build-meta.ts`.

Formato exibido no app:

```text
0.1.0 (build 61a3ed1)
```

Resumo:

- altere a versao manualmente em `package.json`
- nao edite `src/shared/build-meta.ts` manualmente
- o commit/hash da build entra automatico no proximo dev/build
- se `git` nao estiver disponivel, o app mostra apenas a versao base

Exemplo opcional de tag de release apos gerar uma versao:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Auto Update

O GameStock agora pode verificar updates antes de abrir a janela principal. Esse fluxo depende de duas variaveis de build no CI:

- `UPDATE_MANIFEST_URL`: URL publica do JSON com metadados da release atual.
- `BUILD_NUMBER`: identificador textual da build exibido na splash. Se nao existir, o app reaproveita o hash curto do commit gerado em `src/shared/build-meta.ts`.
- Na ausencia dessas variaveis, o app usa o endpoint padrao `https://s3.alexishida.com/gamestock/meta-dados.json`.

Quando `UPDATE_MANIFEST_URL` nao estiver definida, o app pula a splash e abre direto a janela principal. Isso mantém o fluxo de desenvolvimento local sem bloqueio.

### Formato do manifesto

O endpoint remoto precisa responder HTTP `200` com um JSON neste formato:

```json
{
  "version": "0.2.0",
  "buildNumber": "20260518.1",
  "releaseDate": "2026-05-18",
  "downloadUrl": "https://example.com/releases/gamestock-0.2.0.zip",
  "releaseNotes": "Correcoes, melhorias e novos recursos"
}
```

Tambem existe compatibilidade com o formato legado em pt-br atualmente publicado no S3:

```json
{
  "data": "2026-05-18 22:26:00",
  "versao": "0.0.1",
  "build": "53133c5",
  "path": "https://s3.alexishida.com/gamestock/53133c5.zip"
}
```

Regras usadas pelo updater:

- `version` e comparada com `app.getVersion()` usando semver simples (`x.y.z`); se a versao for igual mas o `buildNumber`/`build` for diferente, o update tambem e aplicado.
- `downloadUrl` deve apontar para um `.zip` contendo uma pasta raiz `app/`.
- Alias aceitos no manifesto: `versao` para `version`, `data` para `releaseDate` e `path` para `downloadUrl`.
- erro de rede (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) abre modal offline na splash.
- erro de servidor, JSON invalido ou download corrompido nao bloqueia o app: a splash fecha e o GameStock abre normalmente.

### Publicacao de release

Passo a passo recomendado:

1. Atualize o campo `version` do `package.json`.
2. Gere os artefatos com `npm run build:renderer` e `npm run build:main` ou `npm run dist:windows`.
3. Monte um pacote `.zip` da pasta `app/` que sera instalada no `resourcesPath/app`.
4. Publique o `.zip` em uma URL acessivel pelo app.
5. Atualize o JSON do manifesto remoto com a nova `version`, `buildNumber`, `releaseDate`, `downloadUrl` e `releaseNotes`.
6. No CI, injete `UPDATE_MANIFEST_URL` e opcionalmente `BUILD_NUMBER` durante o build final distribuido aos usuarios.

Fluxo em runtime:

- splash abre antes da janela principal
- app verifica o manifesto com timeout de 5s
- se houver versao remota mais nova, baixa o ZIP para pasta temporaria
- ZIP e extraido para `_update_staging`
- app relanca com `--apply-update <stagingPath>` e copia staging para `resourcesPath/app`
- boot seguinte repete a verificacao normalmente

## Testes

Smoke test da importacao por pasta de ROMs:

```bash
npm run test:rom-folder-import
```

E2E da importacao LaunchBox contra o app compilado:

```bash
npm run test:launchbox:e2e
```

E2E da importacao LaunchBox contra o app empacotado em `release/win-unpacked/`:

```bash
npm run test:launchbox:e2e:packaged
```

O E2E compila o app, baixa/cacheia metadados LaunchBox, pesquisa por "Sonic", importa imagens "Box - Front" e verifica se o jogo aparece com capa na grade.

## Dados Locais

O GameStock armazena dados de runtime fora do repositorio:

| Caminho | Conteudo |
|---------|----------|
| `%APPDATA%/gamestock/gamestock.db` | Banco SQLite |
| `%APPDATA%/gamestock/images/` | Capas, backgrounds, screenshots e outras midias baixadas |
| `%APPDATA%/gamestock/launchbox_cache/` | `Metadata.xml`, `index.json` e cache da LaunchBox |
| `%APPDATA%/gamestock/window-bounds.json` | Posicao e tamanho da janela |

Entradas de pastas de ROMs configuradas, historico de jobs e estado persistido da UI ficam no SQLite local, na tabela `app_state`.

## Importador LaunchBox

O importador baixa `https://gamesdb.launchbox-app.com/Metadata.zip`, extrai `Metadata.xml` e cria um indice local em `index.json`. O cache e reutilizado quando tem menos de 24 horas, salvo quando uma atualizacao forcada e solicitada.

A busca usa o indice local, pode filtrar por plataforma e limita resultados para manter a UI responsiva. Ao importar, o GameStock cria ou atualiza o jogo no SQLite, baixa as imagens escolhidas e gera um `cover.jpg` otimizado com `sharp` quando ha imagem "Box - Front".

## Importacao por Pasta de ROMs

O assistente fica em **Configuracoes > Biblioteca**. Ele permite cadastrar pastas, escolher plataforma, escanear ROMs suportadas, revisar arquivos encontrados e iniciar importacao em background.

Extensoes suportadas incluem `.zip`, `.rom`, `.bin`, `.iso`, `.img`, `.cue`, `.nes`, `.snes`, `.sfc`, `.smc`, `.swc`, `.fig`, `.smd`, `.md`, `.n64`, `.z64`, `.v64`, `.gb`, `.gbc` e `.gba`.

O assistente oferece dois modos: plataforma manual (usuario escolhe) e **deteccao automatica**, que usa as extensoes principais cadastradas por plataforma para identificar e separar ROMs de multiplas plataformas na mesma pasta. A busca em subpastas e opcional e pode ser ativada no formulario de configuracao.

Durante o job, o app tenta casar cada ROM com a LaunchBox por titulo e plataforma. Jogos com match sao criados ou atualizados sem duplicar registros; ROMs sem match entram no resumo final.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Desktop shell | Electron 41 |
| Renderer | React 19 + TypeScript + Vite 7 |
| Estado | Zustand 5 |
| Banco | SQLite via `better-sqlite3` |
| IPC | `contextBridge` / `ipcRenderer` |
| Midia | `sharp` |
| LaunchBox | `adm-zip` + `xml2js` |
| UI icons | `lucide-react` |
| Build | `electron-builder` |

## Arquitetura

- Canais IPC ficam em `src/shared/ipc-channels.ts`.
- Handlers do processo main ficam em `src/main/index.ts`.
- API segura do renderer e exposta em `src/preload/index.ts` como `window.gameStockAPI`.
- Tipos compartilhados ficam em `src/shared/types.ts` e `src/preload/types.d.ts`.
- Codigo SQLite fica em `src/main/db`, com DAOs em `src/main/db/dao` e repositorios em `src/main/db/repositories`.
- Componentes React ficam em `src/renderer/components`.
