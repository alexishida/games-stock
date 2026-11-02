<!-- Instruções do protótipo nativo; a distribuição atual continua sendo Electron. -->
# GameStock nativo — protótipo de migração

Este diretório contém a implementação C++20/Qt Quick em migração. Biblioteca, inventário, importadores, jobs e portabilidade de dados já têm serviços e telas nativas; atualizador, instaladores/ponte de distribuição e o corte final permanecem pendentes. O protótipo exige perfil explícito e lê um catálogo JSON ou banco SQLite sintético; não abre automaticamente o banco real.

## Ferramentas

Qt **6.8.3**, CMake **3.25 ou superior**, MSVC **2022 x64** no Windows 11. O preset Linux usa Ninja/GCC e Qt da mesma versão, configurado em `QT_ROOT`. O baseline Linux é Ubuntu 22.04 x86_64/GCC 11; a etapa Linux está adiada por decisão do usuário (01/11/2026) e registrada em [Linux adiado](../docs/native-migration/linux-deferred.md).

O Qt usado localmente fica em `../.native-tools/Qt/6.8.3/msvc2022_64`; não há mudança global no PATH. O CMake instalado com Visual Studio pode ser chamado por seu caminho completo se não estiver no PATH. A seleção dos módulos e licenças está em [dependências](../docs/native-migration/dependencies.md).

## Build Windows

No terminal que contém CMake:

```powershell
cmake --preset windows-msvc -S native
cmake --build native/build/windows-msvc --config Release --parallel 4
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
```

O executável fica em `native/build/windows-msvc/Release/gamestock_native.exe`. Os testes iniciais de geometria usam QCoreApplication e não abrem janelas.

O roteiro `scripts/native-smoke.ps1` também executa testes de busca, limpeza, paginação e rolagem horizontal QML offscreen em `native/tests/qml`, com serviço simulado. Nesse executor isolado, avisos de imagens `qrc:/icons` são esperados porque os recursos são embutidos no executável, não no `qmltestrunner`; o teste não certifica a renderização dos ícones. Os avisos ficam no relatório completo `native/build/qml-test-results.txt`. Para executar os testes separadamente, use `powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1`.

O mesmo teste cobre as primitives `ActionButton`, `FormField` e `DragDialog`: arraste e limites do modal principal e de um modal superior, interação de botão e campo sem arraste, foco via Tab, Escape, bloqueio do diálogo inferior e escurecimento em um ponto da camada inferior. A verificação é offscreen com backend software no Windows; fidelidade dos efeitos e custo na GPU permanecem nas tarefas visuais específicas.

Em 01/11/2026, `powershell -ExecutionPolicy Bypass -File scripts/native-smoke.ps1 -Build -Capture -Offscreen` concluiu configure, build Release e o teste `window-state` no Windows; também gerou `artifacts/native-migration/qt-prototype.png` com catálogo sintético. A captura offscreen não valida efeitos ou desempenho da GPU. Esta evidência cobre somente o protótipo Windows e não conclui as verificações Linux nem a migração funcional.

A referência Electron da tarefa 1.4 foi ampliada para 29 estados por execução, nas nove combinações de resolução/escala, e ganhou benchmark com 5.000 jogos sintéticos. Comandos, ambiente, cobertura, limitações e resultados estão em [referência Electron no Windows](../docs/native-migration/windows-reference.md). As pastas `electron-reference-*` são locais e ignoradas pelo Git.

`node scripts/native-theme-check.cjs` compara o tema QML com o CSS efetivo: 18 tokens de cor, duas sombras, medidas básicas e 16 desenhos Lucide, incluindo variantes ativas e licença. Executado com sucesso em 01/11/2026; a tipografia continua sendo a família resolvida pelo sistema, como na referência.

No teste gráfico Windows a 100%, a primeira abertura e a reabertura preservaram o retângulo externo Win32 de 1122 × 957 e a área útil de 1106 × 918, iguais aos da referência Electron medida. As bordas invisíveis do Windows são incluídas no JSON legado; a matriz de resoluções/escalas foi executada em 01/11/2026 e está em [matriz visual](../docs/native-migration/visual-matrix.md): os quatro elementos estruturais ficam dentro de 1 px lógico nas nove combinações.

O desfoque do backdrop, as sombras e as transições foram calibrados contra o Electron em [efeitos do protótipo](../docs/native-migration/windows-effects.md). O `MultiEffect` não aceita um `Item` comum como fonte: o fundo vira camada enquanto há modal aberto e o scrim fica no overlay. A escala medida é `blurMax` 32 para `blur(8px)` e `shadowBlurMax` 60 para `0 30px`. Sombra do modal e re-desfoque do primeiro modal na pilha continuam como limitações registradas.

Para verificar o backend em um perfil isolado no Windows, após o build:

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
$env:QT_QPA_PLATFORM = 'offscreen'
$env:QT_QUICK_BACKEND = 'software'
$env:QT_QPA_FONTDIR = Join-Path $env:WINDIR 'Fonts'
$env:QSG_INFO = '1'
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir artifacts/native-migration/qt-diagnostic-windows --capture artifacts/native-migration/qt-diagnostic-windows.png
```

O comando foi executado em 01/11/2026: o log registrou `Loading backend software`, e `native-prototype.log` e `window-bounds.json` foram criados no perfil indicado. Execute em um processo PowerShell separado para não manter essas variáveis no ambiente de uso normal. A versão exibida inclui o commit disponível durante a configuração CMake; sem Git, exibe apenas a versão.

## Executar com fixtures

Na raiz:

```powershell
node scripts/native-fixtures.cjs
```

Usar o diretório exclusivo impresso pelo comando:

```powershell
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir artifacts/native-migration/qt-prototype --catalog artifacts/native-migration/fixtures-<sufixo>/catalog.json
```

`--capture <arquivo.png>` salva uma captura e encerra. `--geometry-report <arquivo.json>` grava as medidas lógicas de sidebar, TopBar, busca e primeiro card. `--content-size LARGURAxALTURA` fixa a área útil exata da matriz de resoluções (usada por `scripts/native-visual-matrix.ps1`, que repete as nove combinações da referência Electron). A pasta de destino deve existir. Logs e window-bounds.json ficam somente no perfil indicado. `--view-list` inicia na lista para capturas. Os controles ainda não portados permanecem desabilitados; a lista já usa linhas tabulares próprias, mas indicadores, ações e fidelidade visual ainda precisam de validação e conclusão.

Para reproduzir uma busca em capturas, acrescente `--search "texto sintético"`; um termo sem correspondência exercita o estado vazio e o botão de limpar sem consultar o perfil pessoal. `--open-settings` e `--open-stacked` abrem o modal de Configurações e, no segundo caso, o detalhe por cima para comparar a camada modal empilhada; `--no-backdrop-blur`, `--backdrop-blur`, `--shadow-blur` e `--modal-shadow-blur` existem somente para as medições de efeitos.

Para experimentar a paginação no SQLite, use uma cópia sintética gerada pelo roteiro de referência Electron com `--games=5000`. Informe o banco **dentro** do perfil de teste; o serviço abre somente para leitura:

```powershell
$fixtureProfile = "$PWD/artifacts/native-migration/electron-reference-<sufixo>/profile"
native/build/windows-msvc/Release/gamestock_native.exe --profile-dir $fixtureProfile --fixture-db "$fixtureProfile/gamestock.db"
```

O serviço experimental oferece busca e paginação; o DAO também implementa filtros e ordenação para comparação, mas ainda não oferece CRUD nem todos os fluxos da biblioteca. A normalização de gênero foi comparada em casos selecionados com o Electron, incluindo acentos, sigma grego e I pontuado, sem certificar toda a tabela Unicode. Essa fase não autoriza abrir o perfil real antes do lock e da proteção de migrations.

## Linux

```sh
export QT_ROOT=/caminho/Qt/6.8.3/gcc_64
cmake --preset linux-gcc -S native
cmake --build native/build/linux-gcc --parallel 4
ctest --test-dir native/build/linux-gcc --output-on-failure
```

Para diagnóstico Qt, `QT_DEBUG_PLUGINS=1` informa módulos/plugins carregados e `QSG_INFO=1` informa o backend gráfico. `QT_QPA_PLATFORM=offscreen` e `QT_QUICK_BACKEND=software` são opções de teste; seus resultados não certificam blur, sombras ou performance do renderizador GPU da distribuição. Não usar flags Electron para tentar corrigir o runtime Qt.

## Referências e estado

- [Matriz gerada de operações e telas](../docs/native-migration/parity.md).
- [Referência Electron e matriz de capturas](../docs/native-migration/windows-reference.md).
- [Matriz visual de resoluções e escalas](../docs/native-migration/visual-matrix.md).
- [Efeitos, sombras e custo medidos](../docs/native-migration/windows-effects.md).
- [Banco de dados, migrations e seeds](../docs/native-migration/database.md).
- [Perfil, lock e recuperação](../docs/native-migration/profile.md).
- [Comparação do protótipo com o Electron](../docs/native-migration/prototype-comparison.md).
- [Backup, cinco categorias e compatibilidade cruzada](../docs/native-migration/backup.md).
- [Updater assinado e GitHub Releases](../docs/native-migration/updates.md).
- [Instalador e portátil Windows](../docs/native-migration/installer.md).
- [Pacote local, hashes e evidências do corte](../docs/native-migration/release-cut.md).
- [Benchmark Electron × Qt](../docs/native-migration/benchmark.md).
- [Decisões de equivalência](../docs/native-migration/decisions.md).
- [Fixtures e limitações observadas do backup](../docs/native-migration/fixtures.md).
- [Escopo Linux adiado](../docs/native-migration/linux-deferred.md).
- [Tarefas OpenSpec](../openspec/changes/migrate-desktop-to-qt-qml/tasks.md).

O runtime final será independente de Node/React. `native-assets.cjs` é somente uma ferramenta de desenvolvimento para extrair desenhos SVG do pacote Lucide existente; os SVGs gerados e a licença já ficam nos fontes. O logo é o asset atual do projeto.

`DataPaths` contém a resolução do perfil legado e validação de caminhos, testadas no Windows com override, APPDATA, espaços, acentos, traversal e junction externa. O provider de imagens abre o arquivo, confere seu destino real pelo mesmo identificador e lê por esse identificador, com limite de 64 MiB. No Linux, a implementação usa `/proc/self/fd` e continua pendente de compilação e testes no sistema alvo. O argumento opcional `--media-dir` define a raiz de mídia sintética; sem ele, usa-se o perfil explícito. O caminho do perfil real ainda não é aberto automaticamente: isso continua bloqueado até o lock comum e a abertura segura com migrations.

`FolderStateStore` salva e mescla entradas de pastas no formato `app_state` legado, preservando campos extras e aplicando a mesma chave local de deduplicação do renderer. A mescla é transacional e foi testada em SQLite temporário, inclusive com falha simulada. Essa escrita ainda não está ligada ao protótipo nem autorizada para o perfil real: faltam o lock comum e a abertura segura com migrations.

`LibraryFilterStore` reconhece o JSON legado de filtros da biblioteca, aplica os mesmos fallbacks para opções ausentes ou desconhecidas e valida os valores antes de gravar. Os testes usam SQLite temporário; a hidratação e a gravação no runtime de produção continuam pendentes da abertura segura do perfil.
