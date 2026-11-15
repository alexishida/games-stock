<#
Gera localmente o instalador Windows e o pacote portátil do GameStock.
A versão é lida do projeto para manter os dois artefatos alinhados ao CMake.
Uso: powershell -ExecutionPolicy Bypass -File scripts/native-release.ps1
Use -CompileJobs 8 para ajustar o paralelismo conforme a memória disponível.
Use -BuildOnly para compilar sem gerar instalador/ZIP durante o desenvolvimento.
Use -PackageFormat Installer ou Portable para gerar apenas um formato.
#>
param(
    [string]$OutputDirectory = "",
    # Quatro processos por target são um padrão conservador para os arquivos grandes de QML.
    [ValidateRange(1, 64)]
    [int]$CompileJobs = [Math]::Min(4, [Environment]::ProcessorCount),
    [switch]$BuildOnly,
    [switch]$Reconfigure,
    [ValidateSet('Both', 'Installer', 'Portable')]
    [string]$PackageFormat = 'Both',
    [ValidateSet('LZMA', 'Zlib')]
    [string]$InstallerCompression = 'LZMA'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$native = Join-Path $root 'native'
$cmakeFile = Join-Path $native 'CMakeLists.txt'

# Manter a versão fonte única evita que o nome dos arquivos e o instalador diverjam do executável.
$cmakeText = Get-Content -LiteralPath $cmakeFile -Raw
if ($cmakeText -notmatch 'project\(GameStockNative VERSION ([0-9]+\.[0-9]+\.[0-9]+)') {
    throw "Não foi possível ler a versão de $cmakeFile."
}
$version = $matches[1]

$cmakeCommand = Get-Command cmake -ErrorAction SilentlyContinue
$cmake = if ($cmakeCommand) { $cmakeCommand.Source } else { $null }
if (-not $cmake) {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe')
    )
    $cmake = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $cmake) { throw 'CMake não encontrado. Instale o CMake ou o Visual Studio 2022 Build Tools.' }

# Resolver a saída a partir da raiz do repositório permite executar o script em qualquer diretório.
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root 'release/windows' }
if (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory = Join-Path $root $OutputDirectory
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

Write-Host "Gerando GameStock $version para Windows..."
$totalTimer = [System.Diagnostics.Stopwatch]::StartNew()
$phaseTimer = [System.Diagnostics.Stopwatch]::StartNew()
# O MSBuild chama CMake quando as entradas mudam; evitar configuração incondicional economiza tempo.
$buildDirectory = Join-Path $native 'build/windows-msvc'
$cacheFile = Join-Path $buildDirectory 'CMakeCache.txt'
$presetFile = Join-Path $native 'CMakePresets.json'
$needsConfigure = $Reconfigure -or -not (Test-Path -LiteralPath $cacheFile)
if (-not $needsConfigure) {
    $cacheText = Get-Content -LiteralPath $cacheFile -Raw
    $needsConfigure = $cacheText -notmatch "(?m)^GAMESTOCK_MSVC_COMPILE_JOBS:STRING=$CompileJobs\r?$" `
        -or (Get-Item -LiteralPath $presetFile).LastWriteTimeUtc -gt (Get-Item -LiteralPath $cacheFile).LastWriteTimeUtc
}
if ($needsConfigure) {
    & $cmake --preset windows-msvc -S $native "-DGAMESTOCK_MSVC_COMPILE_JOBS=$CompileJobs"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar o build Release do Windows.' }
}
Write-Host ("Configuração: {0:N1} s" -f $phaseTimer.Elapsed.TotalSeconds)

# O target inclui as dependências do aplicativo e dispensa a compilação dos executáveis de teste.
# Dois projetos simultâneos limitam a multiplicação de processos iniciados por /MP.
$phaseTimer.Restart()
& $cmake --build (Join-Path $native 'build/windows-msvc') --config Release --target gamestock_native --parallel 2
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o GameStock em Release.' }
Write-Host ("Compilação: {0:N1} s ({1} arquivos por target)" -f $phaseTimer.Elapsed.TotalSeconds, $CompileJobs)

# O modo local reaproveita a build Release e dispensa a compressão dos pacotes a cada ajuste.
if ($BuildOnly) {
    Write-Host ("Build concluída em {0:N1} s: {1}" -f $totalTimer.Elapsed.TotalSeconds, (Join-Path $buildDirectory 'Release/gamestock_native.exe'))
    exit 0
}

# O empacotador existente cria o instalador e o ZIP a partir da mesma build já compilada.
$installerScript = Join-Path $PSScriptRoot 'native-installer.ps1'
$phaseTimer.Restart()
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerScript `
    -Version $version -OutputDirectory $OutputDirectory -PackageFormat $PackageFormat -InstallerCompression $InstallerCompression
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar os pacotes do GameStock.' }
Write-Host ("Empacotamento: {0:N1} s; total: {1:N1} s" -f $phaseTimer.Elapsed.TotalSeconds, $totalTimer.Elapsed.TotalSeconds)

Write-Host "Release local concluído em $OutputDirectory"
if ($PackageFormat -ne 'Portable') { Write-Host "  GameStock-$version-Setup.exe" }
if ($PackageFormat -ne 'Installer') { Write-Host "  GameStock-$version-Portable.zip" }
