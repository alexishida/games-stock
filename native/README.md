<!-- Guia atual do aplicativo C++/QML; relatórios históricos ficam em docs/native-migration. -->
# GameStock C++/Qt Quick

Este é o único aplicativo do projeto: C++20, Qt 6.8.3 Quick/QML e SQLite via QSQLITE.
Biblioteca, emuladores, importadores, inventário, jobs, backups e updater usam serviços nativos.
Design e layout atuais são a referência aprovada: Theme.qml e .ai-framework/DESIGN.md.

## Compilar no Windows

Na raiz, com CMake 3.25+, MSVC 2022 x64 e Qt 6.8.3 em .native-tools/Qt:

```powershell
cmake --preset windows-msvc -S native
cmake --build native/build/windows-msvc --config Release --parallel 4
scripts/native-run.cmd
```

O executável fica em native/build/windows-msvc/Release/gamestock_native.exe.
O atalho prepara Qt e 7-Zip local e abre o mesmo perfil do Electron:
%APPDATA%/gamestock ou GAMESTOCK_USER_DATA_DIR. Não exige reimportação.
Para testes, forneça explicitamente --profile-dir com uma pasta isolada.

## Verificar

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
python scripts/native-fixtures.py
```

Python 3 é opcional para materializar fixtures e usa somente a biblioteca padrão.
Não execute testes no perfil pessoal. Os testes comuns usam QTemporaryDir e dados artificiais.
O pacote legado de backup e os SQLs em tests/fixtures preservam referências sem Electron.

## Estrutura

- src/app: bootstrap, perfil, lock, geometria, mídia e execução controlada.
- src/db: conexões, schema, migrations e DAOs.
- src/services e src/models: serviços QObject e modelos observáveis para QML.
- src/jobs: registro, gerência e workers.
- src/launchbox, src/portability e src/update: metadados, backup e atualização.
- qml: janela principal, tema e componentes compartilhados.
- assets: fontes, marca e ícones locais.
- tests: testes C++/QML e fixtures sintéticas de compatibilidade.
- third_party: bibliotecas ZIP e ferramenta de extração, com licenças.
- tools: benchmark nativo de desenvolvimento.
- build: saídas locais de compilação, ignoradas pelo Git.

[Comandos](../scripts/README.md) ·
[Paridade e perfil](../docs/native-migration/current-project-audit.md) ·
[Linux adiado](../docs/native-migration/linux-deferred.md)
