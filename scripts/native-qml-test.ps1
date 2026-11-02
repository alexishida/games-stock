<# Executa testes QML isolados com o Qt local e sem acessar perfil do usuário. #>
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qtRoot = Join-Path $projectRoot '.native-tools/Qt/6.8.3/msvc2022_64'
$runner = Join-Path $qtRoot 'bin/qmltestrunner.exe'
if (-not (Test-Path -LiteralPath $runner)) { throw 'qmltestrunner do Qt local não encontrado.' }
$previousPath = $env:PATH
$previousPlatform = $env:QT_QPA_PLATFORM
$previousBackend = $env:QT_QUICK_BACKEND
$previousFonts = $env:QT_QPA_FONTDIR
$previousStyle = $env:QT_QUICK_CONTROLS_STYLE
Push-Location $projectRoot
try {
    $env:PATH = "$qtRoot/bin;$env:PATH"
    $env:QT_QPA_PLATFORM = 'offscreen'
    $env:QT_QUICK_BACKEND = 'software'
    # O executável usa o estilo Basic; o runner deve usar o mesmo estilo.
    $env:QT_QUICK_CONTROLS_STYLE = 'Basic'
    $env:QT_QPA_FONTDIR = Join-Path $env:WINDIR 'Fonts'
    # O módulo mínimo reutiliza o singleton real sem depender dos recursos do executável.
    $importRoot = Join-Path $projectRoot 'native/build/qml-test-import'
    $module = Join-Path $importRoot 'GameStock'
    New-Item -ItemType Directory -Force -Path $module | Out-Null
    Copy-Item -LiteralPath 'native/qml/Theme.qml' -Destination (Join-Path $module 'Theme.qml') -Force
    Set-Content -Encoding ascii -LiteralPath (Join-Path $module 'qmldir') -Value "module GameStock`nsingleton Theme 1.0 Theme.qml"
    $report = Join-Path $projectRoot 'native/build/qml-test-results.txt'
    & $runner -input 'native/tests/qml' -import $importRoot -o "$report,txt"
    $testExit = $LASTEXITCODE
    if (Test-Path -LiteralPath $report) {
        # O runner não carrega os recursos do executável; outros avisos continuam visíveis.
        Get-Content -LiteralPath $report | Where-Object { $_ -notmatch '^QWARN.*Cannot open: qrc:/icons/' }
        Write-Output 'Avisos esperados de ícones qrc estão preservados no relatório completo.'
    }
    if ($testExit -ne 0) { throw 'Falha nos testes QML.' }
} finally {
    $env:PATH = $previousPath
    $env:QT_QPA_PLATFORM = $previousPlatform
    $env:QT_QUICK_BACKEND = $previousBackend
    $env:QT_QPA_FONTDIR = $previousFonts
    $env:QT_QUICK_CONTROLS_STYLE = $previousStyle
    Pop-Location
}
