<!-- Evidências de extração de ROM e lançamento (tarefa 6.2). -->
# Lançamento de jogos e cache de ROMs

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `native/src/app/RomLaunchExtraction.*` | Cache `Temp/gamestock/extracted-roms`, marcador `.gamestock-launch.json`, escolha do arquivo principal e limpeza de 7 dias. |
| `native/src/services/LaunchService.*` | Resolve jogo/emulador/core, monta argumentos, inicia processo e incrementa `launch_count`. |
| `native/src/app/ExecutableResolver.*` | Resolve o binário do emulador antes do spawn. |
| `native/src/app/RetroArchCores.*` | Resolve `-L <core>` por caminho manual ou fallback do catálogo. |
| `native/tests/FakeEmulator.cpp` | Emulador de teste que grava `argv` em UTF-8 para inspeção. |

## Regras preservadas

- `zip`/`7z` são extraídos para uma pasta por caminho + tamanho + mtime; launches repetidos
  reaproveitam o marcador e o arquivo escolhido.
- A escolha prioriza `.m3u`, `.cue`, `.gdi`, `.ccd`, `.toc`, depois a maior ROM primária do catálogo
  e, por fim, o maior arquivo que não seja metadado/compactado.
- Falha de extração devolve o pacote original, preservando emuladores que leem ZIP diretamente.
- Plataformas `Arcade` mantêm o ZIP sem extração para MAME/Supermodel.
- Emulador genérico recebe `args` tokenizados com aspas; `{romPath}` e `{romFileName}` são
  substituídos. Sem marcador, a ROM é anexada como último argumento.
- RetroArch recebe `-L <corePath> <romPath>`; sem core configurado/encontrado, o launch falha.
- `launch_count` só é incrementado depois de `QProcess::startDetached` confirmar o início; falhas de
  ROM, emulador, core ou spawn não alteram o histórico.
- O cache manual remove apenas o diretório dedicado e o recria vazio.

## Dependência 7-Zip

O runtime procura, nesta ordem: `GAMESTOCK_7Z_PATH`, `7za/7z/7zz` ao lado do executável ou em
`tools/`, e por fim `7za/7z/7zz` no `PATH`. Nos testes Windows/CI usa-se o binário já presente em
`node_modules/7zip-bin`; empacotamento e `.deb`/AppImage serão tratados na tarefa 10.7.

`GAMESTOCK_EXTRACTION_DIR` permite isolar o cache em testes e builds portáteis.

## Evidências

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release -R launch-service --output-on-failure
```

`launch-service` cobre:

- argumentos com marcadores, aspas, espaços e acentos, gravados pelo emulador falso;
- incremento de `launch_count` em dois launches bem-sucedidos;
- ZIP e 7z extraídos, reaproveitamento do cache e falha de pacote devolvendo o arquivo original;
- ZIP de Arcade preservado sem extração;
- ausência de ROM/emulador/executável/core e falha de spawn sem incremento;
- RetroArch com `-L`, core resolvido por fallback e ROM separada.

## Regras por sistema operacional

### Windows

- Executáveis usam `PATHEXT` (`.EXE`, `.CMD`, `.BAT`, `.COM`) quando não há extensão no valor salvo.
- Cores são procurados como `.dll` em `cores/`; o processo é iniciado por `QProcess::startDetached`.
- O binário `7za.exe` é procurado em `GAMESTOCK_7Z_PATH`, ao lado do app, em `tools/` e no `PATH`.
- O teste `launch-service` cobre caminho/argumentos com espaços e acentos (`Ação (USA).sfc`) e
  `argv` em UTF-8 via `fake_emulator`.

### Linux

- Executáveis precisam do bit de execução (validado por `QFileInfo::isExecutable`); ausência retorna
  `NOT_EXECUTABLE`.
- Cores usam `.so`; o fluxo de argumentos e cache é o mesmo. O 7-Zip deve estar disponível em
  `7za/7z/7zz` (PATH, `GAMESTOCK_7Z_PATH` ou `tools/`).
- A compilação e o smoke com `fake_emulator` no Linux continuam adiados conforme
  [linux-deferred.md](linux-deferred.md) (tarefa 6.4).

## Smoke Windows (01/11/2026)

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
$env:GAMESTOCK_7Z_PATH = "$PWD/node_modules/7zip-bin/win/x64/7za.exe"
native/build/windows-msvc/Release/launch_service_tests.exe
ctest --test-dir native/build/windows-msvc -C Release -R launch-service --output-on-failure
```

O emulador falso recebeu `{romPath}`/`{romFileName}`, ZIP/7z, paths com acentos, falhas de spawn e
RetroArch `-L core rom`; o contador só subiu após spawn bem-sucedido.

## Limitações registradas

- A extração é síncrona nesta etapa; mover para worker/job acontece na tarefa 7.1.
- ZIP64 e limites de recurso pertencem à tarefa 9.1; aqui o foco é o launch de pacotes suportados.
- A verificação Linux continua adiada; o teste usa `fake_emulator` e o caminho Linux do 7zip-bin
  permanece preparado para a retomada.
