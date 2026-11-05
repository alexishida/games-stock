<#
Executa o protótipo Qt na matriz de resoluções/escalas da referência Electron.
Cada execução usa um perfil sintético e a área útil exata registrada pelo Electron.
#>
param(
    [string]$ReferenceRoot = 'artifacts/native-migration',
    [string]$OutputRoot = 'artifacts/native-migration/qt-matrix-windows'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qtRoot = Join-Path $projectRoot '.native-tools/Qt/6.8.3/msvc2022_64'
$exe = Join-Path $projectRoot 'native/build/windows-msvc/Release/gamestock_native.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Compile o protótipo antes de gerar a matriz.' }
$fixtureRun = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'artifacts/native-migration') -Directory -Filter 'fixtures-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $fixtureRun) { throw 'Gere fixtures com python scripts/native-fixtures.py.' }
# Mídias e banco pertencem ao mesmo perfil sintético.
$mediaDir = Join-Path $fixtureRun.FullName 'legacy-populated'
$fixtureDb = Join-Path $mediaDir 'gamestock.db'
if (-not (Test-Path -LiteralPath $fixtureDb)) { throw 'Gere o perfil de comparação (qt-effects-windows) primeiro.' }

$previousPath = $env:PATH
$previousImports = $env:QML_IMPORT_PATH
$previousScale = $env:QT_SCALE_FACTOR
$profile = Join-Path $projectRoot ($OutputRoot + '/profile')
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $OutputRoot) | Out-Null

# O banco de fixture precisa estar dentro do perfil explícito; as mídias ficam na raiz permitida.
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Copy-Item -LiteralPath $fixtureDb -Destination (Join-Path $profile 'gamestock.db') -Force
$fixtureDbCopy = Join-Path $profile 'gamestock.db'

Push-Location $projectRoot
try {
    $env:PATH = "$qtRoot/bin;$env:PATH"
    # Os testes usam os módulos da mesma instalação Qt do build.
    $env:QML_IMPORT_PATH = "$qtRoot/qml;$env:QML_IMPORT_PATH"
    $manifest = @()
    # Aproveita referências históricas, ou verifica a matriz desktop nativa quando ausentes.
    $captureCases = @()
    foreach ($referenceDirectory in Get-ChildItem -LiteralPath $ReferenceRoot -Directory -Filter 'electron-reference-*') {
        $environmentPath = Join-Path $referenceDirectory.FullName 'environment.json'
        if (Test-Path -LiteralPath $environmentPath) {
            $referenceEnvironment = Get-Content -LiteralPath $environmentPath -Raw | ConvertFrom-Json
            if ($referenceEnvironment.page) { $captureCases += [pscustomobject]@{ Name=$referenceDirectory.Name; Environment=$referenceEnvironment } }
        }
    }
    if ($captureCases.Count -eq 0) {
        foreach ($size in @(@(1024,768), @(1122,957), @(1920,1080))) {
            foreach ($factor in @(1.0,1.25,1.5)) {
                $captureCases += [pscustomobject]@{ Name="native-$($size[0])x$($size[1])-$factor"; Environment=[pscustomobject]@{page=[pscustomobject]@{width=$size[0];height=$size[1];scale=$factor}} }
            }
        }
    }
    foreach ($reference in $captureCases) {
        $environment = $reference.Environment
        if (-not $environment.page) { continue }
        $width = [int]$environment.page.width
        $height = [int]$environment.page.height
        $scale = [double]$environment.page.scale
        $label = "$($environment.requestedWindowSize)|$scale"
        $name = $reference.Name
        $target = Join-Path $projectRoot (Join-Path $OutputRoot $name)
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        $env:QT_SCALE_FACTOR = ([string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $scale))
        # O stderr do executável é diagnóstico esperado; não deve abortar o roteiro.
        $callPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $exe --profile-dir $profile --fixture-db $fixtureDbCopy --media-dir $mediaDir --content-size "$($width)x$($height)" --capture (Join-Path $target 'biblioteca.png') --geometry-report (Join-Path $target 'biblioteca.json') 2>&1 | Out-Null
        $ErrorActionPreference = $callPreference
        if ($LASTEXITCODE -ne 0) { throw "Falha ao capturar $name." }
        $manifest += [pscustomobject]@{ reference = $name; size = $label; scale = $scale; pageWidth = $width; pageHeight = $height }
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot (Join-Path $OutputRoot 'matrix.json'))
    $manifest | Format-Table -AutoSize
} finally {
    $env:PATH = $previousPath
    $env:QML_IMPORT_PATH = $previousImports
    $env:QT_SCALE_FACTOR = $previousScale
    Pop-Location
}
