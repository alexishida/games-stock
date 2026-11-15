<!-- Comandos atuais: o aplicativo e seu build não dependem de Electron ou npm. -->
# Ferramentas do projeto

Execute na raiz. CMake/MSVC/Qt compilam o aplicativo; PowerShell organiza execução e distribuição.
Python 3 com biblioteca padrão é necessário apenas para gerar/copiar fixtures sintéticas.

| Script | Finalidade |
|---|---|
| `native-run.cmd` / `native-run.ps1` | Abrir o aplicativo com o perfil existente; aceita `--profile-dir` para isolar testes |
| `native-smoke.ps1 -Build` | Compilar e executar CTest + testes QML |
| `native-qml-test.ps1` | Testar controles, navegação, modais e fluxos QML offscreen |
| `native-fixtures.py` | Recriar banco antigo e populado a partir dos SQLs sintéticos congelados |
| `native-profile-db.py` | Copiar uma fixture consistentemente, incluindo WAL, e preparar estados de captura |
| `native-visual-matrix.ps1` | Capturar a biblioteca em nove combinações de resolução e escala |
| `native-parity-matrix.ps1` | Capturar os estados da interface; aceita `-Only` e `-ScreenFilter` |
| `native-deploy.ps1` | Montar uma pasta executável com Qt, runtime C++ e 7-Zip |
| `native-installer.ps1` | Gerar instalador NSIS e ZIP portátil localmente |
| `native-release.ps1` | Compilar e gerar ambos os pacotes ou apenas o formato solicitado |
| `native-sign-update.ps1` | Assinar o manifesto com chave externa ao repositório |

O atalho de execução abre `%APPDATA%/gamestock` por padrão. Para testes, forneça um perfil exclusivo.

Para gerar apenas um pacote, use `native-release.ps1 -PackageFormat Installer` ou
`native-release.ps1 -PackageFormat Portable`. O padrão `Both` produz os dois. Para medir uma
alternativa de instalador maior e mais rápida, `-InstallerCompression Zlib` troca a compressão;
o padrão de distribuição continua sendo LZMA sólido. `-BuildOnly` dispensa o empacotamento.
Os scripts informam o tempo e o tamanho de cada pacote. A comparação local e suas limitações estão
em `docs/native-migration/benchmark.md`.
As matrizes usam somente fixtures e aproveitam referências históricas quando disponíveis; sem elas,
geram os casos de 1024×768, 1122×957 e 1920×1080 em 100%, 125% e 150%.

Não há instalação npm, gerador dependente do Electron ou publicação automática.
