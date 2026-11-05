<#
Captura todas as telas comparáveis nas nove combinações de resolução/escala da referência Electron.
Cada captura usa uma cópia sintética limpa; o perfil real nunca é aberto.
#>
param(
    [string]$ReferenceRoot = 'artifacts/native-migration',
    [string]$OutputRoot = 'artifacts/native-migration/parity-matrix',
    [string]$Only = '',
    # Filtra estados por expressão regular para repetir apenas as telas afetadas no ajuste visual.
    [string]$ScreenFilter = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qtRoot = Join-Path $projectRoot '.native-tools/Qt/6.8.3/msvc2022_64'
$exe = Join-Path $projectRoot 'native/build/windows-msvc/Release/gamestock_native.exe'
$fixtureRun = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'artifacts/native-migration') -Directory -Filter 'fixtures-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $fixtureRun) { throw 'Gere fixtures com python scripts/native-fixtures.py.' }
# A fixture é isolada e independente do runtime removido.
$fixture = Join-Path $fixtureRun.FullName 'legacy-populated'
$fixtureDb = Join-Path $fixture 'gamestock.db'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Compile o runtime Qt antes de gerar a matriz.' }
if (-not (Test-Path -LiteralPath $fixtureDb)) { throw 'Fixture sintética ausente.' }

$baseDir = Join-Path $projectRoot (Join-Path $OutputRoot 'base')
New-Item -ItemType Directory -Force -Path $baseDir | Out-Null
$cleanDb = Join-Path $baseDir 'clean.db'
$jobsDb = Join-Path $baseDir 'jobs.db'
& python (Join-Path $PSScriptRoot 'native-profile-db.py') $fixtureDb $cleanDb clean
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar o banco limpo.' }
& python (Join-Path $PSScriptRoot 'native-profile-db.py') $fixtureDb $jobsDb jobs
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar o banco com jobs.' }

# Estados reproduzíveis pela UI e pelas flags de captura do runtime nativo.
$screens = @(
    [pscustomobject]@{ name = 'biblioteca'; flags = @() },
    [pscustomobject]@{ name = 'biblioteca-lista'; flags = @('--view-list') },
    [pscustomobject]@{ name = 'biblioteca-vazia'; flags = @('--search=zzz-sem-correspondencia') },
    [pscustomobject]@{ name = 'jogo-detalhe'; flags = @('--open-detail') },
    # O visualizador foi restaurado na auditoria de paridade; inclui navegação e exportação.
    [pscustomobject]@{ name = 'jogo-galeria'; flags = @('--open-gallery') },
    [pscustomobject]@{ name = 'jogo-edicao'; flags = @('--open-detail-edit') },
    [pscustomobject]@{ name = 'jogo-versao'; flags = @('--open-detail-versions') },
    [pscustomobject]@{ name = 'inventario'; flags = @('--open-inventory') },
    [pscustomobject]@{ name = 'inventario-lista'; flags = @('--open-inventory', '--inventory-list') },
    [pscustomobject]@{ name = 'inventario-novo-item'; flags = @('--open-inventory-form') },
    [pscustomobject]@{ name = 'inventario-novo-tipo'; flags = @('--open-inventory-new-type') },
    [pscustomobject]@{ name = 'inventario-detalhe'; flags = @('--open-inventory-detail') },
    [pscustomobject]@{ name = 'inventario-edicao'; flags = @('--open-inventory-edit') },
    [pscustomobject]@{ name = 'inventario-confirmacao-exclusao'; flags = @('--open-inventory-delete') },
    [pscustomobject]@{ name = 'configuracoes-plataformas'; flags = @('--open-platforms') },
    [pscustomobject]@{ name = 'plataformas-nova'; flags = @('--open-platform-new') },
    [pscustomobject]@{ name = 'plataformas-edicao'; flags = @('--open-platform-edit') },
    [pscustomobject]@{ name = 'plataformas-vinculos'; flags = @('--open-platform-mappings') },
    [pscustomobject]@{ name = 'configuracoes-emuladores'; flags = @('--open-emulators') },
    [pscustomobject]@{ name = 'emuladores-novo'; flags = @('--open-emulator-new') },
    [pscustomobject]@{ name = 'emuladores-edicao'; flags = @('--open-emulator-edit') },
    [pscustomobject]@{ name = 'emuladores-vinculos'; flags = @('--open-emulator-links') },
    [pscustomobject]@{ name = 'emuladores-vincular-plataforma'; flags = @('--open-emulator-link') },
    [pscustomobject]@{ name = 'emuladores-cores'; flags = @('--open-emulator-cores') },
    [pscustomobject]@{ name = 'configuracoes-pastas'; flags = @('--open-rom-importer') },
    [pscustomobject]@{ name = 'configuracoes-midia'; flags = @('--open-covers') },
    [pscustomobject]@{ name = 'configuracoes-partidas'; flags = @('--open-play-history') },
    [pscustomobject]@{ name = 'configuracoes-backup'; flags = @('--open-backup') },
    [pscustomobject]@{ name = 'configuracoes-logs'; flags = @('--open-logs') },
    [pscustomobject]@{ name = 'configuracoes-sobre'; flags = @('--open-settings') },
    [pscustomobject]@{ name = 'notificacoes'; flags = @(); db = 'jobs' },
    [pscustomobject]@{ name = 'update-splash'; flags = @('--update-splash-preview') }
)

$previousPath = $env:PATH
$previousImports = $env:QML_IMPORT_PATH
$previousScale = $env:QT_SCALE_FACTOR
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
        if ($Only -and $reference.Name -notlike "*$Only*") { continue }
        $environment = $reference.Environment
        if (-not $environment.page) { continue }
        $width = [int]$environment.page.width
        $height = [int]$environment.page.height
        $scale = [double]$environment.page.scale
        $profile = Join-Path $projectRoot (Join-Path $OutputRoot "$($reference.Name)/profile")
        $target = Join-Path $projectRoot (Join-Path $OutputRoot $reference.Name)
        New-Item -ItemType Directory -Force -Path $profile | Out-Null
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        $env:QT_SCALE_FACTOR = ([string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $scale))
        $capturedCount = 0
        foreach ($screen in $screens) {
            if ($ScreenFilter -and $screen.name -notmatch $ScreenFilter) { continue }
            $source = if ($screen.db -eq 'jobs') { $jobsDb } else { $cleanDb }
            Copy-Item -LiteralPath $source -Destination (Join-Path $profile 'gamestock.db') -Force
            $capture = Join-Path $target ($screen.name + '.png')
            $arguments = @('--profile-dir', $profile, '--fixture-db', (Join-Path $profile 'gamestock.db'),
                '--media-dir', $fixture, '--content-size', "$($width)x$($height)") + $screen.flags + @('--capture', $capture)
            $geometry = Join-Path $target 'biblioteca.json'
            if ($screen.name -eq 'biblioteca') { $arguments += @('--geometry-report', $geometry) }
            $callPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $exe @arguments 2>&1 | Out-Null
            $ErrorActionPreference = $callPreference
            if ($LASTEXITCODE -ne 0) { throw "Falha ao capturar $($reference.Name)/$($screen.name)." }
            $capturedCount++
        }
        $manifest += [pscustomobject]@{
            reference = $reference.Name
            size = "$($width)x$($height)"
            scale = $scale
            screens = $capturedCount
            geometry = $geometry
        }
        Write-Output "Matriz capturada: $($reference.Name) ($($width)x$($height) @ $scale)"
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $projectRoot (Join-Path $OutputRoot 'matrix.json'))
} finally {
    $env:PATH = $previousPath
    $env:QML_IMPORT_PATH = $previousImports
    $env:QT_SCALE_FACTOR = $previousScale
    Pop-Location
}
