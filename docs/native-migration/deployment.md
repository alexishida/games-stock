<!-- Deploy local do runtime nativo (10.1; instalador final pertence a 10.7). -->
# Deploy local do runtime nativo

## O que o script faz

`scripts/native-deploy.ps1`:

1. Compila o Release (pode ser omitido com `-SkipBuild`).
2. Executa `windeployqt --release --qmldir native/qml --no-translations --compiler-runtime`.
3. Copia `7za.exe` e a licença do 7-Zip para `tools/`.
4. Copia o runtime C++ (`Microsoft.VC143.CRT`) quando encontra o Build Tools local.
5. Pode publicar em uma pasta separada com `-OutputDirectory`.
6. Cria `portable.marker` na pasta publicada; o runtime detecta o canal `portable`.

```powershell
# Deploy ao lado do executável de build
powershell -ExecutionPolicy Bypass -File scripts/native-deploy.ps1

# Pasta de distribuição local (portátil)
powershell -ExecutionPolicy Bypass -File scripts/native-deploy.ps1 -SkipBuild -OutputDirectory artifacts/native-migration/dist-portable
```

## Perfil real, sem argumentos

A partir da tarefa 10.1 o app **não exige** `--profile-dir`:

- sem argumento, resolve `GAMESTOCK_USER_DATA_DIR`, depois `%APPDATA%/gamestock` (Windows) ou
  `$XDG_DATA_HOME/gamestock`/`~/.local/share/gamestock` (Linux);
- abre/cria `gamestock.db` com `Database::open` (snapshot + migrations idempotentes) e só então
  inicia os serviços;
- mantém o lock de perfil antes de qualquer escrita;
- `--profile-dir` continua disponível para fixtures e testes isolados; `--fixture-db` exige perfil
  explícito para não tocar no perfil real.

## Identidade de canal

`native/src/app/ChannelIdentity.*` detecta:

1. `GAMESTOCK_CHANNEL=portable|installed|development` (override explícito);
2. `PORTABLE_EXECUTABLE_DIR` (compatibilidade com o portátil Electron);
3. `portable.marker` ao lado do executável;
4. `install.marker` ou `uninstall*.exe`;
5. `development` como fallback.

A identidade (canal, diretório do executável, marcador e data) é gravada em
`app_state/gamestock.build.channel` e exibida em Configurações → Sobre. A seleção de pacote não
depende apenas do SO.

## Executar sem Qt/Node no PATH

Com `PATH=C:\Windows\System32;C:\Windows` e `GAMESTOCK_USER_DATA_DIR` temporário, a cópia publicada
abriu Configurações→Backup e gerou captura:

```powershell
$env:PATH = 'C:\Windows\System32;C:\Windows'
$env:GAMESTOCK_USER_DATA_DIR = 'D:\...\deployed-profile'
artifacts\native-migration\dist-portable\gamestock_native.exe --open-backup --capture ...\dist-portable-clean.png
```

Log: `Canal detectado: portable`, sem erro de DLL Qt ausente. `channel-identity` cobre os marcadores
e a persistência em SQLite.

## O que ainda não é distribuição final

- Não há instalador NSIS nem `.deb`/AppImage (tarefa 10.7; Linux adiado).
- A ponte de transição Electron→Qt e os metadados `latest.yml`/NSIS legados pertencem às tarefas
  10.4/10.5.
- A assinatura/updater nativo está em [updates.md](updates.md); a publicação no GitHub é manual.
- A validação em VM limpa sem Qt/Node/Visual Studio e a matriz de instalação/desinstalação
  permanecem pendentes.
- `windeployqt` avisa sobre `dxcompiler.dll`/`dxil.dll` e `VCINSTALLDIR`; o runtime C++ é copiado
  pelo script e o backend D3D pode usar fallback/OpenGL conforme a máquina.
