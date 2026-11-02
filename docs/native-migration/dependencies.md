<!-- Versões e licenças escolhidas para tornar o ambiente nativo reproduzível. -->
# Dependências e ferramentas nativas

| Dependência | Versão/baseline | Uso e redistribuição |
|---|---|---|
| C++ | C++20 | Padrão explícito por target; sem extensões proprietárias no domínio. |
| Qt | 6.8.3 exato no CMake | Core, Gui, Qml, Quick, QuickControls2, Sql, Network, Svg, ImageFormats e ShaderTools; Test somente em desenvolvimento. Usar a alternativa LGPLv3 aplicável ou licença comercial conforme cada módulo. Incluir avisos/fontes e permitir substituição das bibliotecas quando exigido; não incorporar módulos GPL-only por conveniência. |
| Compilador Windows | MSVC 2022 x64, toolset 14.44 no ambiente verificado | Windows 11; SDK 10.0.26100 encontrado localmente. Runtime VC redistribuído conforme licença Microsoft quando empacotar. |
| Compilador Linux | GCC 11 no Ubuntu 22.04 x86_64 | Baseline de build definido; validação Linux ainda pendente. Qt pode exigir bibliotecas de sistema adicionais por formato/plugin. |
| CMake | mínimo 3.25 | Presets versão 6 e build independente de npm. O ambiente Windows usa a cópia do Visual Studio. |
| Ninja | fornecido pelo ambiente Linux | Gerador do preset Linux; Windows usa o gerador Visual Studio. |
| SQLite | QSQLITE da distribuição Qt selecionada | Manter schema, PRAGMAs e funções customizadas equivalentes; conferir versão real ao implementar os DAOs. SQLite é domínio público, e a licença do plugin Qt também se aplica. |
| libarchive | 3.8.11 vendorizada em `native/third_party/libarchive-3.8.11` | ZIP/ZIP64 streaming; licença BSD-2-Clause e hash fixados em `native/third_party/README.md`. Integrada ao build estático apenas com zlib; STORED/DEFLATED, ZIP64 forçado e pacote real acima de 4 GiB comprovados no teste `portable-archive`. |
| zlib | 1.3.1 vendorizada em `native/third_party/zlib-1.3.1` | Necessária para entradas DEFLATED; licença zlib e hash registrados no mesmo README. Compilada estaticamente junto com a libarchive. |
| Lucide | desenhos do lucide-react instalado no projeto | SVGs locais com licença ISC copiada para native/assets/LUCIDE-LICENSE.txt; React não acompanha o runtime Qt. |
| Fontes e logo | assets existentes/fonte efetiva por SO | Não adicionar Inter silenciosamente: a referência atual usa Segoe UI/system-ui/Arial. O logo existente não é substituído. |
| aqtinstall | 3.3.0, somente ferramenta local | Instalado em .native-tools/python para baixar o Qt; não é dependência distribuída nem alteração global do Python. |

Os módulos ligados ao executável inicial estão declarados em native/CMakeLists.txt. Formatos de imagem e shaders também são instalados para as verificações seguintes. A criação de instaladores deve verificar as licenças efetivas dos plugins/dependências incluídos e guardar os avisos junto ao pacote.

Fontes primárias consultadas para as decisões:

- [Plataformas suportadas pelo Qt 6.8](https://doc.qt.io/qt-6.8/supported-platforms.html).
- [Licenciamento Qt](https://www.qt.io/development/qt-framework/qt-licensing).
- [Release libarchive 3.8.11](https://github.com/libarchive/libarchive/releases/tag/v3.8.11).
- [Projeto e formatos libarchive](https://github.com/libarchive/libarchive/wiki).

Este registro fixa escolhas e obrigações de redistribuição; ZIP64 foi validado no build Windows, mas instaladores e o runtime Linux continuam pendentes.
