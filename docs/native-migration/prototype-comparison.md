<!-- Comparação visual do protótipo QML com a referência Electron da tarefa 1.4. -->
# Protótipo da biblioteca versus Electron

Comparação da tela principal reconstruída em QML (tarefa 3.2). As duas capturas usam a mesma cópia de banco e mídia sintética, 1122 × 957 externos (1106 × 918 lógicos), escala 100% e Windows 10.0.26300. Qt 6.8.3/MSVC 2022 contra Electron 43.3.0.

## Como reproduzir

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
$p = (Resolve-Path 'artifacts/native-migration/qt-compare-windows').Path
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir "$p/profile" --fixture-db "$p/profile/gamestock.db" --media-dir "$p/profile" --capture "$p/biblioteca.png" --geometry-report "$p/biblioteca.json"
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir "$p/profile" --fixture-db "$p/profile/gamestock.db" --media-dir "$p/profile" --view-list --capture "$p/biblioteca-lista.png"
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir "$p/profile" --fixture-db "$p/profile/gamestock.db" --media-dir "$p/profile" --search "sem-correspondencia" --capture "$p/biblioteca-vazia.png"
node scripts/native-geometry-check.cjs artifacts/native-migration/electron-reference-fWbTwI/environment.json artifacts/native-migration/qt-compare-windows/biblioteca.json
```

A pasta `qt-compare-windows/profile` é cópia do perfil Electron, com `box_art_path` realocado apenas na cópia. Para a paginação, repetir com `qt-compare-large-windows`, derivada de `electron-reference-kvJLgH` (5.000 jogos sintéticos, 2.502 grupos) e o mesmo comando de captura em grade.

## Geometria medida

`native-geometry-check.cjs` comparou a captura em grade e aceitou os quatro elementos (limite de 2 px lógicos):

| Elemento | Diferença Qt − Electron |
|---|---|
| Sidebar | 0, 0, 0, 0 |
| TopBar | 0, 0, 0, 0 |
| Busca | x 0, y +0,5, largura 0, altura 0 |
| Primeiro card | 0, 0, 0, 0 |

Na visualização em lista o relatório de geometria não é válido: o card da grade fica invisível e sua posição não representa a linha tabular. A lista foi comparada por captura.

## Resultado visual

- Biblioteca em grade: sidebar, marca, busca, TopBar, contadores, cards, agrupamento de variantes e cores coincidem; o primeiro card fica na mesma posição.
- Biblioteca em lista: colunas Plataforma, Estilo, Publisher, Ano e ícones alinhados; a coluna Título começa cerca de 7 px antes no Qt e o cabeçalho acompanha.
- Busca sem correspondência: mensagem central, contador `Exibindo 0 de 2 jogos` e contadores zerados na sidebar reproduzem o estado Electron.
- Paginação com 5.000 jogos: `1–36 de 2502`, `1 / 70` e os quatro botões coincidem em posição e estado; 36 cards por página.

## Diferenças ainda abertas

1. Com mais de uma página, o Electron exibe uma barra de rolagem vertical à direita da grade; o protótipo passou a desenhá-la em 6 px com o mesmo trilho/polegar (ver [matriz visual](visual-matrix.md)).
2. A linha de filtros (`Exibir sem capa`, `CATEGORIA`, `ORDENAR POR`) tem deslocamento e larguras de seletor visualmente diferentes; ainda não há medição automática desses três controles.
3. Blur de fundo, sombras, gradientes e transições não foram validados nesta comparação; pertencem à tarefa 3.4.
4. A comparação cobre somente Windows a 100%. Resoluções/escalas estão na [matriz visual](visual-matrix.md).

As capturas ficam em `artifacts/`, ignorado pelo Git; a pasta não substitui a evidência textual acima.
