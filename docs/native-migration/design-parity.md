<!-- Evidência dos ajustes visuais nativos, comparados ao renderer Electron preservado no histórico. -->
# Paridade visual com o Electron

A referência desta revisão é o renderer do commit `ca72828`, seus estilos efetivos e as capturas em `artifacts/native-migration/electron-reference-*`. A interface continua em Qt Quick; não há renderer web no runtime.

Os ajustes abrangem biblioteca, inventário, listas, detalhes, configurações, formulários, vínculos, cores do RetroArch, versões, confirmação e notificações. As fontes usam Segoe UI. Após a revisão de legibilidade, os textos usam `QtRendering`, antialiasing explícito e distance field de alta qualidade; campos editáveis usam a mesma renderização, sem alterar os tamanhos CSS em pixels. `FontInfo` verifica que o peso 900 resolve para o estilo Black da própria família, sem fallback para Tahoma.

`UiText`, `SectionIntro`, `FormSelect`, `FormCheckBox`, `CollectionScrollBar` e `PanelFlickable` concentram as regras compartilhadas. Os formulários mantêm campos de 34 px, seletor de plataforma de 36 px, labels de 11 px, conteúdo de 13 px, gap label/campo de 8 px e grupos de 16 px. As ações da sidebar usam 38 px, ícones de 18 px e fundo sem borda.

Os comandos de criação e importação da biblioteca ficam no menu de contexto da coleção e continuam acessíveis por Ctrl+N e Ctrl+I. A linha de filtros segue a referência sem botões adicionais. Operações e dados continuam nos serviços existentes; não houve migration, reset ou reimportação de banco.

## Validação

- Build Release com Qt 6.8.3/MSVC 2022.
- 52 testes QML passaram, incluindo seleção por teclado, menus, fonte efetiva e interação nas cinco categorias de backup.
- 31 estados em 1106 × 918, escala 100%; 31 estados em 1112 × 796, escala 125%; oito estados adicionais em 1904 × 993, escala 100%.
- Quatro estados adicionais em 1024 × 768: detalhe e cadastro de inventário, vínculos de plataforma e backup. O teste do detalhe também verifica que os painéis de dados e fotos têm largura positiva e não se sobrepõem.
- Nos três tamanhos, sidebar, TopBar e primeiro card coincidem em x/y/largura/altura. A busca difere somente no arredondamento vertical: 0,5 px em 100% e 0,4 px em 125%.
- As capturas usam somente cópias sintéticas de perfil. Texto de logs, versão, contadores e mídias refletem o runtime e os dados reais de cada fixture; não são substituídos por valores fictícios para fazer screenshots coincidirem.

As 74 capturas locais ficam em `full-design-final`, `full-design-scaled`, `full-design-wide` e `full-design-minimum`, dentro de `artifacts/native-migration`. Essa evidência cobre os estados acima e não constitui certificação de igualdade pixel a pixel entre Chromium e Qt em qualquer configuração de sistema.

## Reproduzir

```powershell
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
powershell -ExecutionPolicy Bypass -File scripts/native-parity-matrix.ps1 -Only fWbTwI -OutputRoot artifacts/native-migration/full-design-final
powershell -ExecutionPolicy Bypass -File scripts/native-parity-matrix.ps1 -Only eDFtpc -OutputRoot artifacts/native-migration/full-design-scaled
node scripts/native-geometry-check.cjs artifacts/native-migration/electron-reference-fWbTwI/environment.json artifacts/native-migration/full-design-final/electron-reference-fWbTwI/biblioteca.json
```

`-ScreenFilter` aceita uma expressão regular para repetir estados específicos sem refazer toda a matriz.

## Revisão de suavização das fontes

<!-- A cobertura cinza aproxima as bordas da referência sem mudar métricas ou dados. -->
O bootstrap agora define `QSG_DISTANCEFIELD_ANTIALIASING=gray` antes de criar a aplicação. A cobertura neutra elimina as franjas RGB do padrão subpixel do Qt em textos e campos com `QtRendering`, mantendo família, pesos e tamanhos existentes. O ajuste é apenas visual e também se aplica a perfis populados, sem migrations.

Build Release e 52 testes QML passaram. As novas capturas ficam em `artifacts/native-migration/grayscale-final-100` e `grayscale-final-125`. A verificação de geometria confirma sidebar, TopBar e primeiro card sem diferenças; a busca conserva o arredondamento vertical de 0,5/0,4 px. Isso não comprova identidade pixel a pixel de todas as telas.

A rasterização nativa foi substituída por `QtRendering` com antialiasing explícito e alta qualidade nos textos. Inputs e textareas também usam `QtRendering`. Os tamanhos em pixels permanecem os da referência; o peso CSS 800 é normalizado para o estilo Black no Windows, pois o matching padrão do Qt escolhia Bold. O teste de fonte verifica os pesos 800 e 900 pela família e pelo estilo efetivamente usados.

Biblioteca, plataformas e cadastro de inventário foram recapturados em 100% e 125%, nas pastas `font-smoothing-100` e `font-smoothing-125`. A comparação ampliada fica em `font-smoothing-100/font-comparison.png`.

## Medidas diretas de menu e grid

A premissa permanece reproduzir o Electron. Os aumentos de fonte e densidade feitos por interpretação da observação do usuário foram desfeitos. Uma execução do Electron empacotado, em fixture isolada e área útil de 1106 × 918 a 100%, exportou `getComputedStyle` e `getBoundingClientRect` para biblioteca e inventário.

| Elemento | Fonte / peso CSS | Altura medida |
|---|---|---|
| Menu principal | 13 px / 700 | 38 px |
| Subitem de coleção | 12 px / 700 | 32 px |
| Filtro de tipo/condição | 13 px / 700 | 31 px |
| Título do card de inventário | 12 px / 600 | 16 px de linha |
| Plataforma do inventário | 10 px / 400 | 14 px de linha |
| Título do card da biblioteca | 14 px / 700 | 18,2 px de linha |
| Plataforma da biblioteca | 9 px / 900 | 12 px de linha |

Os contadores dos filtros usam 11 px e opacidade 0,7. Os contadores da árvore de plataformas herdam 13 px e opacidade 1, conforme os spans do `PlatformTree` original. A borda de 1 px dos cards entra na conta do padding: o título do inventário começa 9 px depois da borda externa; na biblioteca são 17 px.

Os relatórios de origem estão em `artifacts/native-migration/electron-reference-aBEtPI/*-typography.json`. O Qt exporta suas caixas e fontes no campo `typography` do `--geometry-report`. `scripts/native-typography-check.cjs` compara tamanhos, pesos e famílias sem tolerância, e caixas com tolerância máxima de meio pixel para o arredondamento do layout.

A comparação passou para 13 elementos da biblioteca e 23 do inventário em `exact-typography/qt-100/*-comparison.json`, sem diferenças de família, tamanho ou peso. As caixas dos textos dos cards do inventário coincidem; na biblioteca a diferença de coordenada é inferior a 0,013 px. As linhas do menu diferem somente em 0,5 px no eixo vertical, pelo arredondamento do layout Qt.

A confer?ncia adicional em 125% est? registrada em `exact-typography/qt-125`. As fam?lias, tamanhos e pesos continuam iguais, mas o comparador detecta diferen?as de altura de linha e arredondamento que se acumulam at? 6,7 px nos filtros. Essa escala ainda n?o atende ? toler?ncia de meio pixel; os resultados de 100% n?o devem ser apresentados como igualdade em todas as escalas. O CDP confirmou as fontes efetivamente renderizadas pelo Electron em `electron-reference-48ZHSB/*-typography.json` (`resolvedFonts`), incluindo Segoe UI Bold e Semibold.

<!-- Medidas extraídas do CSS no app.asar da distribuição Electron preservada. -->
## Ajustes de caixas e alinhamentos

A revisão seguinte usa as regras CSS do Electron empacotado como referência. O cabeçalho das configurações reserva 28 px e as introduções reservam 19,2 px, evitando a entrelinha implícita adicional do Qt. O menu mantém o espaçamento de letras de .08em. As listas respeitam padding horizontal de 12 px, ações separadas por 4 px e trilho de rolagem de 6 px.

O formulário de inventário preserva a borda externa no cálculo do padding, o título de 22 px, o recuo de 2 px da área rolável e as colunas de tipo/condição com larguras iguais. Os placeholders usam cinza neutro; a seta de detalhes usa o SVG Lucide local. As superfícies dos campos e do aviso de fotos seguem o gradiente escuro da referência.

Validação: build Release, 52 testes QML e 14 estados capturados por escala em `electron-match-100` e `electron-match-125`. Os últimos ajustes de cabeçalho e inventário foram recapturados em `electron-match-100-final` e `electron-match-125-final`. As verificações de geometria da biblioteca passaram nas duas escalas. Nenhum banco ou formato de persistência foi alterado.

<!-- MSAA negociado com o backend real, sem depender apenas do valor solicitado. -->
## Antialiasing da janela na GPU

O bootstrap solicita MSAA 4x por QSurfaceFormat antes da criação da aplicação. A execução de verificação confirmou Direct3D 11 na NVIDIA GeForce RTX 3080 e `MSAA sample count for the swapchain is 4`; anteriormente eram 1 amostra. O Qt negocia o suporte do dispositivo. O MSAA suaviza geometria na janela; textos e texturas mantêm suas técnicas próprias de suavização. Build Release e captura de configurações concluídos em perfil sintético (`gpu-msaa-profile`, imagem `gpu-msaa4.png`).
