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
$fixtureDb = Join-Path $projectRoot 'artifacts/native-migration/qt-effects-windows/profile/gamestock.db'
if (-not (Test-Path -LiteralPath $fixtureDb)) { throw 'Gere o perfil de comparação (qt-effects-windows) primeiro.' }

$previousPath = $env:PATH
$previousScale = $env:QT_SCALE_FACTOR
$profile = Join-Path $projectRoot ($OutputRoot + '/profile')
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $OutputRoot) | Out-Null
$mediaDir = Join-Path $projectRoot 'artifacts/native-migration/qt-effects-windows/profile'
# O banco de fixture precisa estar dentro do perfil explícito; as mídias ficam na raiz permitida.
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Copy-Item -LiteralPath $fixtureDb -Destination (Join-Path $profile 'gamestock.db') -Force
$fixtureDbCopy = Join-Path $profile 'gamestock.db'

Push-Location $projectRoot
try {
    $env:PATH = "$qtRoot/bin;$env:PATH"
    $manifest = @()
    foreach ($reference in Get-ChildItem -LiteralPath $ReferenceRoot -Directory -Filter 'electron-reference-*') {
        $environmentPath = Join-Path $reference.FullName 'environment.json'
        if (-not (Test-Path -LiteralPath $environmentPath)) { continue }
        $environment = Get-Content -LiteralPath $environmentPath -Raw | ConvertFrom-Json
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
    $env:QT_SCALE_FACTOR = $previousScale
    Pop-Location
}
