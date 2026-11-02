<!-- Referência Electron no Windows; capturas geradas antes do corte, sem perfil pessoal. -->
# Referência Electron no Windows

Esta é a evidência da tarefa 1.4: capturas das telas alcançáveis e medições do Electron em release,
sempre em cópia isolada de fixture sintética. O runtime distribuído hoje é Qt; o Electron é apenas
referência histórica.

## Ambiente da execução

Medido em 01/11/2026:

- Windows 10.0.26300 x64, AMD Ryzen 7 5800X, 32 GiB de RAM.
- Tela 2560 x 1080, área de trabalho 2560 x 1032, DPI 96.
- Electron 43.3.0, aplicativo v1.1.4 (build `ca72828`), renderer Vite de produção.
- Fixture `fixtures-H6UzzV`, gerada por `scripts/native-fixtures.cjs`: duas entradas de biblioteca,
  dois itens de inventário, três emuladores, plataformas com aliases/extensões e jobs persistidos.
- Perfil copiado para `electron-reference-<sufixo>/profile`; a origem não é alterada. O modo portátil
  desativa o updater automático e um `Metadata.xml` sintético impede download real.

## Cobertura de telas

O roteiro gravou 29 estados por execução e registrou a lista efetiva em
`environment.json.captures`:

- Biblioteca em grade com variantes agrupadas; detalhe; edição; seleção de versão; biblioteca em lista.
- Inventário em cards; novo item; novo tipo; detalhe; edição; confirmação de exclusão; lista.
- Configurações: plataformas, emuladores, biblioteca, mídia, partidas, backup, logs e sobre.
- Plataformas: criação, edição e vínculos.
- Emuladores: criação, edição, associações, vínculo de plataforma e cores do RetroArch.
- Centro de notificações com uma exportação de backup iniciada na cópia descartável.

Estados sem captura e motivo: formulário manual de jogo (só abria por listener sem emissor após a
remoção do menu nativo), importador LaunchBox (idem), confirmação de exclusão de jogo
(`window.confirm`), splash/updater (janela separada) e estados transitórios de rede/erro.

## Matriz de resoluções e escalas

As nove combinações foram executadas com o mesmo roteiro completo de 29 capturas. A área útil é a
observada no renderer, já dividida pela escala; o tamanho externo é físico.

| Tamanho solicitado | Escala | Janela externa | Área útil lógica | Evidência |
|---|---:|---:|---:|---|
| 1024 x 768 | 100% | 1024 x 768 | 1008 x 729 | `electron-reference-Wkcc15` |
| 1024 x 768 | 125% | 1280 x 961 | 1011 x 738 | `electron-reference-0uUvOQ` |
| 1024 x 768 | 150% | 1538 x 1152 | 1015 x 742 | `electron-reference-6JWT08` |
| 1122 x 957 | 100% | 1122 x 957 | 1106 x 918 | `electron-reference-fWbTwI` |
| 1122 x 957 | 125% | 1405 x 1033 | 1111 x 795 | `electron-reference-GBA7bn` |
| 1122 x 957 | 150% | 1683 x 1152 | 1111 x 742 | `electron-reference-33w9Oc` |
| 1920 x 1080 | 100% | 1920 x 1032 | 1904 x 993 | `electron-reference-4rOs6w` |
| 1920 x 1080 | 125% | 2400 x 1033 | 1907 x 795 | `electron-reference-5rJeKi` |
| 1920 x 1080 | 150% | 2562 x 1152 | 1697 x 742 | `electron-reference-zk8qC2` |

Limitações registradas: a altura útil máxima desta tela é 1032 px físicos; por isso as combinações
de 1122x957 em 125%/150% e 1920x1080 em 125%/150% representam a área realmente disponível, não o
tamanho solicitado. O DPI do handle permaneceu 96 mesmo com a escala Chromium forçada.

## Benchmark com massa representativa

`electron-reference-kvJLgH` adicionou 5.000 jogos sintéticos em pares de variantes, resultando em
2.502 grupos:

| Consulta | Tempo | Itens | Total | Filtrado |
|---|---:|---:|---:|---:|
| Página 1 | 9,6 ms | 36 | 2502 | 2502 |
| Página 2 | 9,5 ms | 36 | 2502 | 2502 |
| Página 10 | 9,4 ms | 36 | 2502 | 2502 |
| Busca + favoritos | 4,2 ms | 7 | 2502 | 7 |
| Ordenação por mais jogados | 9,6 ms | 36 | 2502 | 2502 |
| Gênero `AÇÃO` + favoritos | 24,6 ms | 36 | 2502 | 1667 |
| Gênero `ς` | 58,3 ms | 1 | 2502 | 1 |
| Gênero `İ` | 60,0 ms | 1 | 2502 | 1 |

O processo principal ocupou 136 MiB e o DevTools respondeu em 258 ms. `rendererFoundMs` mede a
disponibilidade do DevTools, não a abertura completa; a memória cobre apenas o processo principal.
A busca sem correspondência foi capturada em `electron-reference-LyP6h1` com 5.000 jogos.

## Comandos históricos

O gerador foi congelado em `tools/legacy-runtime/scripts/native-electron-reference.cjs` após o corte
e exige o backend Electron preservado e suas dependências de tooling:

```powershell
node tools/legacy-runtime/scripts/native-electron-reference.cjs artifacts/native-migration/fixtures-<sufixo>
node tools/legacy-runtime/scripts/native-electron-reference.cjs artifacts/native-migration/fixtures-<sufixo> --size=1024x768 --scale=1.25
node tools/legacy-runtime/scripts/native-electron-reference.cjs artifacts/native-migration/fixtures-<sufixo> --size=1920x1080 --scale=1.5
node tools/legacy-runtime/scripts/native-electron-reference.cjs artifacts/native-migration/fixtures-<sufixo> --games=5000 --benchmark-only
```

As pastas `electron-reference-*` ficam em `artifacts/`, ignorado pelo Git; os PNGs e `environment.json`
são a evidência local.

## Comparações Qt (histórico)

O protótipo aceita `--geometry-report <arquivo.json>` junto de `--capture`. A matriz final e o
relatório estão em [parity-audit.md](parity-audit.md) e [visual-matrix.md](visual-matrix.md). O
verificador `scripts/native-geometry-check.cjs` continua ativo e compara sidebar, TopBar, busca e
primeiro card; divergências acima de 2 px lógicos são reprovadas.
