<#
Compila e verifica o protótipo Qt local com dados sintéticos.
O modo de captura nunca consulta o perfil real; offscreen registra fontes do SO sem copiá-las.
#>
param(
    [switch]$Build,
    [switch]$Capture,
    [switch]$Offscreen
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qtRoot = Join-Path $projectRoot '.native-tools/Qt/6.8.3/msvc2022_64'
if (-not (Test-Path -LiteralPath "$qtRoot/bin/Qt6Core.dll")) { throw 'Qt 6.8.3 local não encontrado; consulte native/README.md.' }
$cmakeCommand = Get-Command cmake -ErrorAction SilentlyContinue
$cmakeExecutable = if ($cmakeCommand) { $cmakeCommand.Source } else { 'C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe' }
if (-not (Test-Path -LiteralPath $cmakeExecutable)) { throw 'CMake não encontrado.' }
$ctestExecutable = Join-Path (Split-Path -Parent $cmakeExecutable) 'ctest.exe'
$previousPath = $env:PATH
$previousImports = $env:QML_IMPORT_PATH
$previousPlatform = $env:QT_QPA_PLATFORM
$previousBackend = $env:QT_QUICK_BACKEND
$previousFonts = $env:QT_QPA_FONTDIR
Push-Location $projectRoot
try {
    $env:PATH = "$qtRoot/bin;$env:PATH"
    # Os testes usam os módulos da mesma instalação Qt do build.
    $env:QML_IMPORT_PATH = "$qtRoot/qml;$env:QML_IMPORT_PATH"
    if ($Build) {
        & $cmakeExecutable --preset windows-msvc -S native
        if ($LASTEXITCODE -ne 0) { throw 'Falha no configure Qt.' }
        & $cmakeExecutable --build native/build/windows-msvc --config Release --parallel 4
        if ($LASTEXITCODE -ne 0) { throw 'Falha no build Qt.' }
    }
    & $ctestExecutable --test-dir native/build/windows-msvc -C Release --output-on-failure
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes nativos.' }
    # A interação QML roda em processo isolado, sem abrir o perfil real.
    & (Join-Path $PSScriptRoot 'native-qml-test.ps1')
    if ($Capture) {
        $fixtureRun = Get-ChildItem -LiteralPath artifacts/native-migration -Directory -Filter fixtures-* | Sort-Object LastWriteTime -Descending | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'catalog.json') } | Select-Object -First 1
        if (-not $fixtureRun) { throw 'Gere fixtures com python scripts/native-fixtures.py primeiro.' }
        if ($Offscreen) {
            $env:QT_QPA_PLATFORM = 'offscreen'
            $env:QT_QUICK_BACKEND = 'software'
            # O plugin offscreen não usa automaticamente o catálogo de fontes do Windows.
            $env:QT_QPA_FONTDIR = Join-Path $env:WINDIR 'Fonts'
        } else {
            $env:QT_QPA_PLATFORM = 'windows'
            $env:QT_QUICK_BACKEND = $null
        }
        # A mídia da fixture fica separada do perfil de execução do protótipo.
        & native/build/windows-msvc/Release/gamestock_native.exe --profile-dir artifacts/native-migration/qt-prototype --media-dir "$($fixtureRun.FullName)/legacy-populated" --catalog "$($fixtureRun.FullName)/catalog.json" --capture artifacts/native-migration/qt-prototype.png
        if ($LASTEXITCODE -ne 0) { throw 'Falha no carregamento/captura do protótipo Qt.' }
        Write-Output 'Captura: artifacts/native-migration/qt-prototype.png'
    }
} finally {
    $env:PATH = $previousPath
    $env:QML_IMPORT_PATH = $previousImports
    $env:QT_QPA_PLATFORM = $previousPlatform
    $env:QT_QUICK_BACKEND = $previousBackend
    $env:QT_QPA_FONTDIR = $previousFonts
    Pop-Location
}
