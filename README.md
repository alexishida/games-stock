# GameStock

GameStock é um aplicativo desktop para Windows para gerenciar bibliotecas de jogos retrô — caminhos de ROMs, box art, status de jogo e inventário físico — construído com Electron, React, TypeScript, Vite e SQLite.

## Funcionalidades

- **Gerenciamento de biblioteca** — adicione, edite e exclua jogos com título, plataforma, publisher, ano, gênero, classificação e notas
- **Visualização em grade e lista** — grade virtualizada com capa dos jogos e modo lista compacto
- **Navegação por plataformas** — barra lateral agrupada por categoria com contagem de jogos por plataforma
- **Inventário físico** — registre cópias físicas com valores de conservação (Mint → Poor)
- **Favoritos e status de jogo** — marque jogos como favorito e acompanhe o progresso (não jogado / jogando / concluído)
- **Filtros e ordenação** — filtre por plataforma, cópia física, favoritos ou status; ordene por título, ano ou adicionados recentemente
- **ROM e capa** — diálogos nativos de arquivo para associar ROMs e importar imagens de capa
- **Importador LaunchBox** — baixa o arquivo público de metadados do LaunchBox, permite buscar jogos, selecionar tipos de imagem e importar metadados e box art com progresso em tempo real
- **Estado da janela persistente** — memoriza o tamanho e posição da janela entre sessões
- **Dados locais** — todos os dados ficam em disco sob `%APPDATA%/GameStock/`; nada sai da máquina

## Requisitos

- Windows 11
- Node.js ≥ 18
- npm

## Instalação

```bash
npm install
```

O script `postinstall` executa `electron-builder install-app-deps` para recompilar módulos nativos (como `better-sqlite3`) contra o runtime do Electron incluído.

## Desenvolvimento

```bash
npm run dev:windows
```

Inicia o Vite em `localhost:5173`, compila o código Electron main e preload em modo watch, aguarda todas as saídas e abre o Electron.

Se `ELECTRON_RUN_AS_NODE` estiver definido no seu shell, limpe antes de iniciar o Electron manualmente:

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
```

## Build

Compilar o bundle do renderer:

```bash
npm run build:renderer
```

Compilar o código Electron main e preload:

```bash
npm run build:main
```

Gerar o instalador NSIS e builds portáteis do Windows em `release/`:

```bash
npm run dist:windows
```

## Testes

Executar o smoke test de importação LaunchBox contra o app compilado:

```bash
npm run test:launchbox:e2e
```

Executar o mesmo teste contra o app empacotado em `release/win-unpacked/`:

```bash
npm run test:launchbox:e2e:packaged
```

O teste compila o app, busca os metadados do LaunchBox, pesquisa por "Sonic", importa imagens "Box - Front" e verifica se o jogo aparece com capa na grade do renderer.

## Dados Locais

O GameStock armazena todos os dados de runtime fora do repositório:

| Caminho | Conteúdo |
|---------|----------|
| `%APPDATA%/GameStock/gamestock.db` | Banco de dados SQLite |
| `%APPDATA%/GameStock/images/` | Imagens de capa importadas |
| `%APPDATA%/GameStock/launchbox_cache/` | Metadados LaunchBox extraídos |
| `%APPDATA%/GameStock/window-bounds.json` | Posição e tamanho da janela salvos |

## Importador LaunchBox

O importador baixa o `Metadata.zip` do banco de dados público de jogos do LaunchBox e armazena em cache os arquivos XML extraídos localmente. A primeira execução faz o download de um arquivo grande e pode levar alguns minutos. O progresso é transmitido para a UI via IPC do Electron. Buscas subsequentes usam o cache local.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Shell | Electron 41 |
| Renderer | React 19 + TypeScript + Vite 7 |
| Estado | Zustand 5 |
| Banco de dados | better-sqlite3 (SQLite) |
| IPC | Electron contextBridge / ipcRenderer |
| Empacotamento | electron-builder (NSIS + portátil) |
