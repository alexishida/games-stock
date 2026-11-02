<!-- Relatório final da tarefa 11.1: matriz funcional e visual do corte. -->
# Paridade funcional e visual (11.1)

Data: 02/11/2026 · Windows 11 · Qt 6.8.3 / MSVC 2022 · Electron 43.3.0

## Escopo e método

- Referência: capturas `electron-reference-*` da fixture sintética `fixtures-H6UzzV`, nunca o perfil real.
- Matriz visual: **31 estados** reproduzíveis em **9 combinações** de resolução/escala, com perfil
  limpo recriado antes de cada captura.
- Geometria: `scripts/native-geometry-check.cjs` compara sidebar, TopBar, busca e primeiro card.
- Função: matriz congelada em `parity.md`, CTest, testes QML e capturas dirigidas de cada fluxo.
- Rasterização de fonte é registrada separadamente e não é tratada como diferença de layout.

## Matriz funcional

A matriz congelada confirma **100 operações/listeners** em **14 domínios**, sem
SQL, `QSqlQuery`/`QSqlDatabase`, `QProcess` ou execução genérica em QML. Todos os domínios estão
marcados como implementados em [parity.md](parity.md).

Evidências executadas em 02/11/2026:

- **CTest 31/31** (`ctest -C Release --output-on-failure`), incluindo `game-service`, `platform-service`,
  `emulator-service`, `launch-service`, `hardware-inventory`, `rom-folder`, `backup-*`, `update-service`
  e o novo `libretro-media`.
- **QML 47/47** (`scripts/native-qml-test.ps1`), 6 arquivos.
- O `npm run typecheck` do runtime Electron foi retirado junto com o código legado no corte 11.5.
- Fallback Libretro de capas/screenshots implementado em `LibretroMedia` e coberto com servidor HTTP local
  (`libretro_media_tests`), inclusive prioridade regional e plataforma não mapeada.
- Jobs interrompidos continuam visíveis para retomada conforme a spec de importação; o Electron
  auto-dispensava jobs terminais de sessões anteriores. A divergência é intencional e documentada.

## Matriz visual

Reprodução:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/native-parity-matrix.ps1
```

Cada referência recebe 31 capturas em `artifacts/native-migration/parity-matrix/<referência>/`:
biblioteca (grade, lista e vazia), detalhe/edição/versão, inventário (grade, lista, criação, tipo,
detalhe, edição e confirmação), plataformas (lista, criação, edição e vínculos), emuladores (lista,
criação, edição, associações, vínculo e cores), configurações (todas as oito seções), notificações e
splash de atualização.

| Combinação | Área útil | Maior desvio | Situação |
|---|---:|---:|---|
| 1024x768 @ 100% | 1008x729 | 1 px (busca) | aprovado |
| 1024x768 @ 125% | 1012x738 | 1 px (busca) | aprovado |
| 1024x768 @ 150% | 1015x742 | 1 px (busca) | aprovado |
| 1122x957 @ 100% | 1106x918 | 1 px (busca) | aprovado |
| 1122x957 @ 125% | 1112x796 | 1 px (busca) | aprovado |
| 1122x957 @ 150% | 1112x742 | 1 px (busca) | aprovado |
| 1920x1080 @ 100% | 1904x993 | 1 px (busca) | aprovado |
| 1920x1080 @ 125% | 1908x796 | 1 px (busca) | aprovado |
| 1920x1080 @ 150% | 1698x742 | 1 px (busca) | aprovado |

Sidebar, TopBar e primeiro card coincidem; a busca varia até 1 px por arredondamento da borda. As
limitações de altura da tela local continuam as registradas em [windows-reference.md](windows-reference.md):
1122x957 em 125%/150% e 1920x1080 em 125%/150% representam a área realmente disponível no Windows.

### Correções desta rodada

- TopBar voltou à busca de 480 px e ao primeiro card em `x=322, y=116`; criar jogo/metadados saíram
  da TopBar para a área livre da faixa de filtros.
- Controles de ordenação/visualização/contador somem quando o detalhe está aberto.
- `GameFormDialog` de edição foi reconstruído com card de título, hub de metadados, cards de arquivos,
  editor manual empilhado e rodapé equivalente ao `GameForm`.
- Moldura de Configurações ganhou engrenagem, ícones Lucide por seção, fechamento por `X`, títulos e
  ações equivalentes; listas de plataformas/emuladores usam separadores e botão de criação no rodapé.
- Mídia, partidas, logs, sobre e backup foram alinhados a títulos, ícones, botões e estatísticas da
  referência; o Sobre recuperou o botão de atualização manual.
- Confirmações usam título, detalhe e ação destrutiva; o seletor de versões foi refeito com cabeçalho,
  título base, grade de informações e link `Jogar`.
- Formulário de inventário ganhou cabeçalho, `X` no topo, rodapé com ações nas extremidades, labels em
  caixa alta e painel recolhível de detalhes.
- Detalhe do jogo: capa 196x274, `Jogar` verde, favorito dourado, ação de exclusão vermelha e setas
  ocultas quando não há jogo anterior/próximo.

### Diferenças aceitas

1. **Criar jogo/importar metadados** ficam visíveis na faixa de filtros. No Electron essas ações só
   existiam no menu nativo removido; mantê-las acessíveis evita perda funcional sem alterar a TopBar.
2. **Canal em Sobre** é exibido como linha adicional, exigido pela tarefa 10.1; o Electron não o mostra.
3. **Jobs interrompidos** permanecem visíveis após reinício, conforme a documentação de retomada.
4. **Microdiferenças de rasterização** de fonte e o trilho de rolagem em telas sem rolagem são
   registrados como diferença gráfica, não de layout.
5. **Estatísticas de inventário** no topo usam a mesma consulta do serviço; isso corrige contagens
   zeradas observadas na referência Electron.

## Conclusão

A matriz funcional e visual está executada nas nove combinações. Não há falha de paridade pendente
dentro do escopo Windows; as diferenças acima são decisões registradas. Linux continua adiado por
decisão do usuário e está listado em [linux-deferred.md](linux-deferred.md).

