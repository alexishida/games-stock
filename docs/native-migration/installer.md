<!-- Instalador e portátil Windows gerados localmente (10.7; Linux adiado). -->
# Instalador e portátil Windows

## Comandos

```powershell
# Deploy + instalador NSIS + ZIP portátil
powershell -ExecutionPolicy Bypass -File scripts/native-installer.ps1

# Reaproveita dist-installer-app já deployado
powershell -ExecutionPolicy Bypass -File scripts/native-installer.ps1 -SkipDeploy
```

Saídas em `artifacts/native-migration/dist-installer/`:

- `GameStock-<versão>-Setup.exe` — NSIS, instalação por usuário;
- `GameStock-<versão>-Portable.zip` — pasta `dist-portable` compactada;
- `gamestock-installer.nsi` — script gerado para auditoria.

NSIS 3.11 fica em `.native-tools/nsis-3.11` (não entra no repositório nem no runtime).

## Identidade

- Produto: `GameStock`; executável instalado: `GameStock.exe`.
- Instalação: `%LOCALAPPDATA%\Programs\GameStock` (mesmo padrão per-user do Electron).
- `install.marker` na pasta instalada → canal `installed`.
- Registro HKCU em `Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app`.
- Atalhos em `%APPDATA%\Microsoft\Windows\Start Menu\Programs\GameStock`.
- O ZIP portátil contém `portable.marker` e mantém `gamestock_native.exe`; o instalador remove o
  executável interno duplicado e usa `GameStock.exe`.

## Teste local executado (Windows, 03/11/2026)

```powershell
$installer = '...\dist-installer\GameStock-1.1.4-Setup.exe'
Start-Process $installer -ArgumentList '/S', '/D=D:\...\install-test' -Wait
# Executar com perfil isolado
$env:GAMESTOCK_USER_DATA_DIR = 'D:\...\installed-profile'
& 'D:\...\install-test\GameStock.exe' --open-backup --capture ...
Start-Process 'D:\...\install-test\Uninstall.exe' -ArgumentList '/S' -Wait
```

Resultados:

- instalação silenciosa saiu com código 0 e criou `GameStock.exe`/`install.marker`;
- execução sem Qt/Node no `PATH` abriu Configurações→Backup, log `Canal detectado: installed`;
- desinstalação saiu com código 0, removeu a pasta e a chave de registro;
- o perfil em `GAMESTOCK_USER_DATA_DIR` permaneceu intacto (banco, imagens, logs e bounds);
- hashes dos artefatos foram registrados pelo script.

## Limitações

- O instalador não é assinado com Authenticode; o updater valida o **manifesto/pacote** com a chave
  Ed25519/ECDSA local, mas o SmartScreen continua independente.
- Linux `.deb`/AppImage permanecem adiados.
- A ponte de atualização Electron→Qt (10.4/10.5) e os metadados `latest.yml` legados ainda não foram
  exercitados; a publicação no GitHub é manual.
- Teste em VM realmente limpa (sem VC++ Redistributable) permanece recomendado; o script copia o
  runtime VC143 quando o Build Tools está presente.
