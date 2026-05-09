## Context

GameStock e um app Electron com renderer React, IPC via `window.gameStockAPI` e persistencia SQLite em `%APPDATA%/GameStock/gamestock.db`. Imagens ficam em `%APPDATA%/GameStock/images`, enquanto entradas configuradas no importador de pastas de ROMs ficam no `localStorage` do renderer (`gamestock.romImport.folderEntries`). O projeto ja usa `adm-zip`, entao o pacote de backup pode ser zipado sem dependencia nova.

## Goals / Non-Goals

**Goals:**
- Permitir exportar e importar dados por categorias independentes: metadados, imagens, plataformas/configuracoes e localizacoes de ROMs.
- Criar pacote local portavel, versionado e validavel antes da importacao.
- Restaurar dados em transacao quando houver escrita no SQLite.
- Regravar caminhos de imagens importadas para o diretorio de dados atual.
- Preservar ROMs fisicas; apenas caminhos e entradas de pastas sao exportados/importados.

**Non-Goals:**
- Copiar arquivos ROM para dentro do backup.
- Sincronizar com nuvem ou abrir fluxo multi-dispositivo.
- Resolver automaticamente caminhos quebrados de ROM em outro computador.
- Substituir o formato atual do banco SQLite por outro storage.

## Decisions

### Pacote `.gamestock-backup` baseado em zip

Usar `adm-zip` para criar um arquivo zip com extensao sugerida `.gamestock-backup`.

Estrutura:

```text
manifest.json
data/games.json
data/platforms.json
data/platformMappings.json
data/emulators.json
data/romLocations.json
media/<media-id>.<ext>
```

`manifest.json` guarda `schemaVersion`, `createdAt`, versao do app, categorias incluidas, contagens e checksums simples dos arquivos listados. Alternativa considerada: pasta solta com JSON e imagens. Rejeitada porque e mais facil perder arquivos e mais dificil importar por dialogo nativo.

### Categorias independentes, com dependencias explicitas

Opcoes de exportacao/importacao:

- `metadata`: registros de jogos sem caminhos de imagens e sem `rom_path`.
- `images`: arquivos referenciados por `box_art_path`, `background_path` e `screenshot_path`, mais mapa para reconectar aos jogos.
- `platforms`: `platforms`, aliases, extensoes, emuladores e vinculos plataforma-emulador.
- `romLocations`: `rom_path` por jogo e entradas de pastas do importador.

Na importacao, `images` depende de jogos existentes ou de `metadata` importado para conseguir associar arquivos. `romLocations` depende de jogos existentes ou de `metadata` importado para aplicar `rom_path`. A UI deve bloquear combinacoes impossiveis ou exibir que parte sera ignorada.

### Matching por chaves estaveis, nao por IDs brutos

IDs SQLite do pacote nao devem ser gravados diretamente. Plataformas sao casadas por `name` case-insensitive. Jogos sao casados por `launchbox_id + platformName` quando houver `launchbox_id`; fallback usa `title + platformName`. Emuladores sao casados por `name`.

Alternativa considerada: preservar IDs originais. Rejeitada porque conflita com bibliotecas existentes e quebra foreign keys em instalacoes diferentes.

### Escrita transacional no main process

Adicionar `src/main/dataPortability.ts` ou modulo equivalente no main. Ele deve:

- Montar payload de exportacao lendo repositorios/DAOs ou consultas dedicadas.
- Validar pacote antes de aplicar importacao.
- Aplicar importacao em `database.transaction(...)`.
- Copiar imagens para `getImagesDir()` em subpasta de importacao antes de atualizar campos de jogos.
- Retornar resumo detalhado de criados, atualizados, ignorados e falhas.

Se qualquer etapa de DB falhar, a transacao deve reverter. Arquivos de imagem ja copiados durante tentativa falha podem ser limpos por lista de paths copiados; se limpeza falhar, o erro deve ser reportado no resumo.

### Integracao com localStorage do RomFolderImporter

Como as entradas de pastas configuradas vivem no renderer, o componente de portabilidade deve ler `gamestock.romImport.folderEntries` e enviar essas entradas para exportacao quando `romLocations` estiver selecionado. Na importacao, o main valida e retorna `romFolderEntries` no resultado; o renderer grava no mesmo localStorage apenas depois de confirmacao e importacao bem-sucedida.

Alternativa considerada: migrar essas entradas para SQLite agora. Rejeitada porque aumentaria escopo e mudaria comportamento de outra capacidade; pode ser proposta futura.

### UX dentro de Configuracoes > Geral

Criar componente dedicado, por exemplo `DataPortabilitySettings`, renderizado na secao `geral` do `SettingsModal`. O fluxo deve usar controles locais: checkboxes para categorias, botoes com icones Lucide, dialogos nativos via IPC para escolher arquivo destino/origem e confirmacao dentro do modal React. Nao criar `BrowserWindow` nova.

## Risks / Trade-offs

- Backup grande com muitas imagens -> mostrar estimativa antes de exportar e executar copia no main para nao travar renderer.
- Caminhos de ROM invalidos em outro PC -> importar mesmo assim, mas marcar no preview/resumo quantos paths nao existem no disco atual.
- Conflitos com dados existentes -> usar matching estavel e resumo antes de aplicar; evitar overwrite silencioso sem confirmacao.
- Pacote antigo/incompativel -> validar `schemaVersion` e recusar versoes nao suportadas com erro claro.
- Entrada de pasta de ROM em localStorage desatualizada -> exportar junto com `indexedCount`, mas recalcular contagens quando o RomFolderImporter abrir.
