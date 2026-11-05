<#
Gera instalador NSIS e pacote portátil Windows localmente.
Não publica nada; os artefatos ficam em release/windows.
Uso:
  powershell -ExecutionPolicy Bypass -File scripts/native-installer.ps1
  powershell -ExecutionPolicy Bypass -File scripts/native-installer.ps1 -Version 1.1.4 -SkipDeploy
#>
param(
    [string]$Version = "",
    [string]$OutputDirectory = "",
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nsis = Join-Path $root '.native-tools/nsis-3.11/makensis.exe'
if (-not (Test-Path -LiteralPath $nsis)) { throw "NSIS não encontrado em $nsis." }

if (-not $Version) {
    $cmakeFile = Get-Content -LiteralPath (Join-Path $root 'native/CMakeLists.txt') -Raw
    if ($cmakeFile -match 'project\(GameStockNative VERSION ([0-9.]+)') { $Version = $matches[1] }
}
if (-not $Version) { throw 'Informe -Version.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root 'release/windows' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$appSource = Join-Path $root 'native/build/package-staging/windows'
if (-not $SkipDeploy) {
    # A limpeza fica limitada ao staging conhecido dentro do workspace.
    $stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'native/build')) + [System.IO.Path]::DirectorySeparatorChar
    if (-not ([System.IO.Path]::GetFullPath($appSource)).StartsWith($stagingRoot)) { throw 'Staging fora do build.' }
    if (Test-Path -LiteralPath $appSource) { Remove-Item -LiteralPath $appSource -Recurse -Force }
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'native-deploy.ps1') `
        -SkipBuild -OutputDirectory $appSource | Out-Host
}
$nativeExe = Join-Path $appSource 'gamestock_native.exe'
if (-not (Test-Path -LiteralPath $nativeExe) -and -not (Test-Path -LiteralPath (Join-Path $appSource 'GameStock.exe'))) { throw "Executável deployado ausente: $nativeExe" }
# A identidade visível continua GameStock.exe, como na distribuição Electron.
if (Test-Path -LiteralPath $nativeExe) {
    Copy-Item -LiteralPath $nativeExe -Destination (Join-Path $appSource 'GameStock.exe') -Force
    Remove-Item -LiteralPath $nativeExe -Force
}
# O build instalado não deve carregar o marcador portátil do deploy.
Remove-Item -LiteralPath (Join-Path $appSource 'portable.marker') -ErrorAction SilentlyContinue

$outFile = Join-Path $OutputDirectory "GameStock-$Version-Setup.exe"
$scriptPath = Join-Path $OutputDirectory 'gamestock-installer.nsi'
$content = @'
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif
!ifndef SOURCE_DIR
  !error "SOURCE_DIR não definido"
!endif
!ifndef OUT_FILE
  !error "OUT_FILE não definido"
!endif

Name "GameStock"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\GameStock"
InstallDirRegKey HKCU "Software\GameStock" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "GameStock ${APP_VERSION}"
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\GameStock.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir GameStock"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "GameStock" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"
  FileOpen $0 "$INSTDIR\install.marker" w
  FileWrite $0 "installed=1$\r$\nversion=${APP_VERSION}$\r$\n"
  FileClose $0

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\GameStock" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "DisplayName" "GameStock"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "Publisher" "Alex Ishida"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "DisplayIcon" "$INSTDIR\GameStock.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app" "NoRepair" 1
  CreateDirectory "$SMPROGRAMS\GameStock"
  CreateShortcut "$SMPROGRAMS\GameStock\GameStock.lnk" "$INSTDIR\GameStock.exe"
  CreateShortcut "$SMPROGRAMS\GameStock\Desinstalar GameStock.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\GameStock\GameStock.lnk"
  Delete "$SMPROGRAMS\GameStock\Desinstalar GameStock.lnk"
  RMDir "$SMPROGRAMS\GameStock"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.gamestock.app"
  DeleteRegKey HKCU "Software\GameStock"
  ; O perfil do usuário em %APPDATA%\gamestock é preservado de propósito.
  RMDir /r "$INSTDIR"
SectionEnd
'@
$content = $content
Set-Content -LiteralPath $scriptPath -Value $content -Encoding utf8

& $nsis /V2 "/DAPP_VERSION=$Version" "/DSOURCE_DIR=$appSource" "/DOUT_FILE=$outFile" $scriptPath
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o instalador NSIS.' }

$portableZip = Join-Path $OutputDirectory "GameStock-$Version-Portable.zip"
# Portátil e instalador usam a mesma build; o marcador impede auto-update no portátil.
$portableSource = Join-Path $root 'release/windows-portable'
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'release')) + [System.IO.Path]::DirectorySeparatorChar
if (-not ([System.IO.Path]::GetFullPath($portableSource)).StartsWith($releaseRoot)) { throw 'Portátil fora de release.' }
if (Test-Path -LiteralPath $portableSource) { Remove-Item -LiteralPath $portableSource -Recurse -Force }
Copy-Item -LiteralPath $appSource -Destination $portableSource -Recurse
Set-Content -LiteralPath (Join-Path $portableSource 'portable.marker') -Value 'portable=1' -Encoding ascii
Remove-Item -LiteralPath (Join-Path $portableSource 'install.marker') -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $portableSource '*') -DestinationPath $portableZip -Force

Get-FileHash -LiteralPath $outFile -Algorithm SHA256 | ForEach-Object { "instalador: $outFile`nsha256: $($_.Hash)" }
if (Test-Path -LiteralPath $portableZip) { Get-FileHash -LiteralPath $portableZip -Algorithm SHA256 | ForEach-Object { "portátil: $portableZip`nsha256: $($_.Hash)" } }
