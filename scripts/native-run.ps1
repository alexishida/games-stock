<#
Executa o GameStock nativo com as DLLs do Qt no PATH e um perfil sintético isolado.
Uso: powershell -ExecutionPolicy Bypass -File scripts/native-run.ps1 [--open-detail ...]
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$qtBin = Join-Path $root '.native-tools/Qt/6.8.3/msvc2022_64/bin'
$executable = Join-Path $root 'native/build/windows-msvc/Release/gamestock_native.exe'

if (-not (Test-Path -LiteralPath $executable)) {
    throw "Executável não encontrado: $executable. Compile com: cmake --build native/build/windows-msvc --config Release"
}
if (-not (Test-Path -LiteralPath (Join-Path $qtBin 'Qt6QuickControls2.dll'))) {
    throw "Qt não encontrado em $qtBin. Ajuste o caminho do Qt local."
}

# Só este processo recebe o PATH; o restante do terminal não é alterado.
$env:PATH = "$qtBin;$env:PATH"

$sourceProfile = Join-Path $root 'artifacts/native-migration/electron-reference-kvJLgH/profile'
$runProfile = Join-Path $root 'artifacts/native-migration/qt-run'
$sourceDatabase = Join-Path $sourceProfile 'gamestock.db'
$runDatabase = Join-Path $runProfile 'gamestock.db'

if (-not (Test-Path -LiteralPath $sourceDatabase)) {
    throw "Fixture de referência não encontrada: $sourceDatabase"
}

New-Item -ItemType Directory -Force -Path $runProfile | Out-Null
if (-not (Test-Path -LiteralPath $runDatabase)) {
    Copy-Item -LiteralPath $sourceDatabase -Destination $runDatabase -Force
}

$arguments = @($args)
if ($arguments -notcontains '--profile-dir') {
    $arguments = @('--profile-dir', $runProfile) + $arguments
    if ($arguments -notcontains '--fixture-db') { $arguments += @('--fixture-db', $runDatabase) }
    if ($arguments -notcontains '--media-dir') { $arguments += @('--media-dir', $sourceProfile) }
}

& $executable @arguments
exit $LASTEXITCODE
