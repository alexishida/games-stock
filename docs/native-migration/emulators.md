<!-- Emuladores, vínculos por plataforma, RetroArch e execução no runtime nativo. -->
# Emuladores e execução

## Serviços e DAOs

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Serviço | `native/src/services/EmulatorService.*` | CRUD, consultas em lote, padrão único por plataforma, PATH/caminhos, cores RetroArch. |
| Serviço de launch | `native/src/services/LaunchService.*` | Resolve emulador/executável, extrai ZIP/7z para cache, monta argumentos separados e inicia o processo. |
| DAOs | `native/src/db/dao/EmulatorDao.*` e `PlatformEmulatorDao.*` | `emulators`, vínculo padrão único, `core_path` e upsert em lote transacional. |
| Executável | `native/src/app/ExecutableResolver.*` | Caminho absoluto/relativo, PATH com `PATHEXT` e permissão POSIX. |
| RetroArch | `native/src/app/RetroArchCores.*` | Catálogo de plataformas/cores, resolução manual/fallback e filtro de cores compatíveis. |
| Modelo | `native/src/models/EmulatorListModel.*` | Papéis `emulatorId`, `name`, `executable`, `args` e `isRetroArch`. |

O catálogo RetroArch foi congelado em `native/src/db/RetroArchCatalogData.cpp`; o gerador histórico
está em `tools/legacy-runtime/scripts/native-retroarch-catalog.cjs`.

## Regras preservadas

- Um emulador pode ser vinculado a várias plataformas, mas só um vínculo é padrão por plataforma.
- Cores RetroArch usam o caminho manual quando informado; sem ele, o fallback escolhe um core
  compatível do catálogo instalado.
- Executáveis são resolvidos em caminho absoluto, relativo ao diretório do perfil ou via `PATH`.
- `launch_count` só é incrementado depois do spawn confirmado.
- ZIP/7z são extraídos para cache temporário; falha de extração ou processo não altera o histórico.
- TeknoParrot usa o perfil `.xml` como ROM, com a migration `teknoparrot-profile-filename-v1`.

## Telas

- `EmulatorManager.qml` lista RetroArch primeiro, depois os demais por nome, com associações
  expansíveis, edição, vínculo e exclusão.
- `EmulatorFormDialog.qml` cobre nome, executável, argumentos e marcação RetroArch.
- `EmulatorLinkDialog.qml` vincula plataformas, define padrão e core.
- `RetroArchCoresDialog.qml` lista cores instalados e permite atualizar após o Core Updater.
- `GameDetailPage.qml` usa `LaunchService` no botão Jogar e no seletor de versões.

## Evidências

- `emulator-service` cobre CRUD, vínculos, padrão único, PATH/caminhos e inventário de cores.
- `launch-service` cobre ZIP/7z, espaços/acentos, emulador falso, falhas e incremento somente no sucesso.
- `hardware-inventory` confirma que excluir plataforma com itens é bloqueado.
- QML `EmulatorSettings` cobre lista, criação, edição, associações, vínculo e cores.

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release -R "emulator-service|launch-service" --output-on-failure
powershell -ExecutionPolicy Bypass -File scripts/native-qml-test.ps1
```
