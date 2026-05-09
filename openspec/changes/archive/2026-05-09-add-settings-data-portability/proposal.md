## Why

GameStock guarda biblioteca, imagens baixadas, plataformas e caminhos de ROM apenas na instalacao local. Sem exportacao/importacao seletiva, o usuario nao consegue migrar, fazer backup ou restaurar partes da biblioteca sem recriar configuracoes manualmente.

## What Changes

- Adicionar em Configuracoes > Geral uma area de portabilidade com acoes de exportar e importar dados.
- Permitir que o usuario escolha categorias independentes para exportacao/importacao: imagens, metadados dos jogos, plataformas, mapeamentos/configuracoes de plataformas e localizacoes de ROMs.
- Gerar um pacote de backup local contendo manifesto versionado, dados estruturados e, quando selecionadas, copias dos arquivos de imagem usados pela biblioteca.
- Importar pacote existente com pre-visualizacao de conteudo, selecao do que restaurar e resumo de impacto antes de gravar dados.
- Preservar arquivos ROM fisicos: exportacao/importacao deve salvar apenas caminhos/localizacoes, nunca copiar ou apagar ROMs.
- Validar compatibilidade do pacote e reportar erros de arquivos ausentes, imagens nao encontradas ou dados invalidos sem corromper a biblioteca atual.

## Capabilities

### New Capabilities

- `data-portability`: Exportacao e importacao seletiva de biblioteca, midias, plataformas, mapeamentos e caminhos de ROM em pacote local versionado.

### Modified Capabilities

- `library-ui`: SettingsModal ganha controles de exportacao/importacao na secao "geral".
- `app-shell`: `window.gameStockAPI` ganha namespace seguro para operacoes de portabilidade via IPC.

## Impact

- **DB**: Leitura e escrita transacional de `games`, `platforms`, aliases/extensoes de plataforma e configuracoes relacionadas.
- **Arquivos**: Criacao/leitura de pacote local com JSON de manifesto/dados e pasta de imagens; ROMs ficam fora do pacote.
- **IPC**: Novos canais em `src/shared/ipc-channels.ts`, handlers em `src/main/index.ts`, exposicao em `src/preload/index.ts` e tipos em `src/preload/types.d.ts`.
- **Main**: Novo servico/repositorio de portabilidade para montar pacote, validar importacao e aplicar restauracao seletiva.
- **UI**: Nova area em `SettingsModal` na secao `geral`, com checkboxes, seletor de arquivo/pasta, preview, confirmacao e resumo.
- **Estado**: Zustand apenas se o fluxo precisar compartilhar status assincrono de exportacao/importacao com notificacoes ou componentes fora do modal.
