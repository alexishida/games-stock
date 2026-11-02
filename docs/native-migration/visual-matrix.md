<!-- Matriz de resoluções/escala do protótipo QML contra a referência Electron (tarefa 3.5). -->
# Matriz visual do protótipo no Windows

Comparação do protótipo QML com as nove capturas Electron da tarefa 1.4, todas na tela principal
(biblioteca em grade) e com a mesma fixture sintética. Mede geometria lógica dos quatro elementos
estruturais, confirma tokens e verifica que nenhum elemento sai da área útil. Executado em
01/11/2026.

## Reprodução

```powershell
powershell -ExecutionPolicy Bypass -File scripts/native-visual-matrix.ps1
node tools/legacy-runtime/scripts/native-theme-check.cjs  # ferramenta histórica; exige o código Electron
```

O roteiro lê cada `artifacts/native-migration/electron-reference-*/environment.json`, usa a área
útil registrada pelo Electron (`page.width × page.height`) e a mesma escala via `QT_SCALE_FACTOR`,
e grava captura e relatório em `artifacts/native-migration/qt-matrix-windows/`. O banco de fixture
é copiado para o perfil da matriz; o perfil real não é aberto.

Cada par é conferido com:

```powershell
node scripts/native-geometry-check.cjs artifacts/native-migration/electron-reference-<sufixo>/environment.json artifacts/native-migration/qt-matrix-windows/electron-reference-<sufixo>/biblioteca.json
```

O verificador aceita área útil com diferença de até 1 px (arredondamento da moldura Win32) e
reprova qualquer elemento com desvio acima de 2 px lógicos.

## Resultado

| Captura | Escala | Área útil | Maior desvio | Situação |
|---|---:|---:|---:|---|
| `electron-reference-Wkcc15` | 100% | 1008 × 729 | 1,0 px | aprovado |
| `electron-reference-0uUvOQ` | 125% | 1012 × 738 | 0,4 px | aprovado |
| `electron-reference-6JWT08` | 150% | 1015 × 742 | 0,33 px | aprovado |
| `electron-reference-fWbTwI` | 100% | 1106 × 918 | 0,5 px | aprovado |
| `electron-reference-GBA7bn` | 125% | 1112 × 796 | 0,4 px | aprovado |
| `electron-reference-33w9Oc` | 150% | 1112 × 742 | 0,33 px | aprovado |
| `electron-reference-4rOs6w` | 100% | 1904 × 993 | 0,5 px | aprovado |
| `electron-reference-5rJeKi` | 125% | 1908 × 796 | 0,4 px | aprovado |
| `electron-reference-zk8qC2` | 150% | 1698 × 742 | 0,33 px | aprovado |

Sidebar, TopBar e primeiro card coincidem exatamente; a busca varia até +0,5 px em Y, herdado da
borda arredondada do campo.

A ferramenta histórica `tools/legacy-runtime/scripts/native-theme-check.cjs` conferiu 18
tokens de cor, 2 sombras, medidas básicas e 16 desenhos Lucide, sem divergência após os ajustes de
efeitos da tarefa 3.4.

## Correção feita nesta tarefa

Com 5.000 jogos, o Electron desenha uma barra de rolagem vertical de 6 px (trilho `#131313`,
polegar `#353534`, raio 4). O protótipo não a exibia porque o `ScrollView` não deduzia a altura do
`Flow`. A grade passou a usar `Flickable` com `contentHeight` explícito e `ScrollBar` no mesmo
estilo; a captura com 2.502 grupos agora mostra a barra na borda direita, sem deslocar os cards
(o Electron também mantém o primeiro card em x = 371 com e sem barra).

## Limitações registradas

1. A tela local tem 2560 × 1080; alturas pedidas acima da área disponível continuam limitadas pelo
   Windows, exatamente como no registro Electron. As combinações de 1122 × 957 em 125%/150% e
   1920 × 1080 em 125%/150% representam o estado real observado, não o tamanho solicitado.
2. `QT_SCALE_FACTOR` reproduz a escala lógica em 125%/150%, mas não é idêntico a mudar o DPI do
   monitor. A rasterização de fonte difere do Chromium em subpixel; por isso a comparação de
   geometria é numérica e a comparação de pixels fica limitada a regiões sem texto.
3. Só a tela principal entrou nesta matriz. As demais telas serão comparadas nas tarefas 5 a 8,
   quando existirem em QML; a captura de cada uma deve repetir este roteiro.
4. A barra de rolagem horizontal da visualização em lista foi validada apenas no teste QML
   offscreen; a captura comparativa está na tarefa 5.

