<!-- Material congelado do runtime Electron para compatibilidade e rollback após o corte. -->
# Runtime legado congelado

O runtime oficial é C++20 + Qt 6 Quick/QML. Esta pasta preserva somente o necessário para
compatibilidade de dados e rollback após a tarefa 11.5:

- `dist/main/` — backend Electron compilado antes do corte, usado por `scripts/native-fixtures.cjs`
  para gerar fixtures sintéticas e comprovar leitura/importação cruzada.
- O código-fonte completo do Electron/React permanece recuperável no histórico do Git
  (`ca72828` e commits anteriores). Ele não é compilado nem distribuído.
- Os artefatos `artifacts/native-migration/electron-release/` e `dist-installer/`, quando presentes
  localmente, são ignorados pelo Git e servem de referência para comparação.

Nada aqui entra no instalador ou no pacote portátil do GameStock. Node/npm são necessários apenas
para executar as ferramentas de fixture/comparação.
