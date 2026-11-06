<#
Gera localmente o instalador Windows e o pacote portátil do GameStock.
A versão é lida do projeto para manter os dois artefatos alinhados ao CMake.
Uso: powershell -ExecutionPolicy Bypass -File scripts/native-release.ps1
#>
param(
    [string]$OutputDirectory = ""
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
& $cmake --preset windows-msvc -S $native
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar o build Release do Windows.' }

& $cmake --build (Join-Path $native 'build/windows-msvc') --config Release --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o GameStock em Release.' }

# O empacotador existente cria o instalador e o ZIP a partir da mesma build já compilada.
$installerScript = Join-Path $PSScriptRoot 'native-installer.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerScript `
    -Version $version -OutputDirectory $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar os pacotes do GameStock.' }

Write-Host "Release local concluído em $OutputDirectory"
Write-Host "  GameStock-$version-Setup.exe"
Write-Host "  GameStock-$version-Portable.zip"
