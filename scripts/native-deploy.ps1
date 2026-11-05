<#
Publica as dependências do Qt ao lado do executável e copia o 7-Zip.
Uso:
  powershell -ExecutionPolicy Bypass -File scripts/native-deploy.ps1
  powershell -ExecutionPolicy Bypass -File scripts/native-deploy.ps1 -OutputDirectory artifacts/native-migration/dist-windows
#>
param(
    [string]$OutputDirectory = "",
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$qtRoot = Join-Path $root '.native-tools/Qt/6.8.3/msvc2022_64'
$windeployqt = Join-Path $qtRoot 'bin/windeployqt.exe'
$cmake = Join-Path $env:ProgramFiles 'Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
if (-not (Test-Path -LiteralPath $cmake)) {
    $cmake = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
}
$release = Join-Path $root 'native/build/windows-msvc/Release'
$executableName = 'gamestock_native.exe'
$executable = Join-Path $release $executableName

if (-not (Test-Path -LiteralPath $windeployqt)) {
    throw "windeployqt não encontrado em $windeployqt."
}
if (-not $SkipBuild) {
    & $cmake --preset windows-msvc -S (Join-Path $root 'native') | Out-Null
    & $cmake --build (Join-Path $root 'native/build/windows-msvc') --config Release --parallel 4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o runtime nativo.' }
}
if (-not (Test-Path -LiteralPath $executable)) {
    throw "Executável não encontrado: $executable"
}

$target = if ($OutputDirectory) {
    $resolved = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $root $OutputDirectory }
    New-Item -ItemType Directory -Force -Path $resolved | Out-Null
    Copy-Item -LiteralPath $executable -Destination (Join-Path $resolved $executableName) -Force
    $resolved
} else {
    $release
}

$targetExecutable = Join-Path $target $executableName
Write-Host "Deployando Qt para $target ..."
& $windeployqt --release --qmldir (Join-Path $root 'native/qml') --no-translations --compiler-runtime $targetExecutable | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao executar windeployqt.' }

# O 7-Zip não faz parte do Qt e precisa ser distribuído junto do executável.
$sevenZip = Join-Path $root 'native/third_party/7zip/win/x64/7za.exe'
$sevenZipLicense = Join-Path $root 'native/third_party/7zip/LICENSE-7zip.txt'
if (-not (Test-Path -LiteralPath $sevenZip)) {
    throw '7za.exe não encontrado em native/third_party/7zip.'
}
$tools = Join-Path $target 'tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null
Copy-Item -LiteralPath $sevenZip -Destination (Join-Path $tools '7za.exe') -Force
Copy-Item -LiteralPath $sevenZipLicense -Destination (Join-Path $tools 'LICENSE-7zip.txt') -Force
# O binário LGPL leva também o texto integral da licença.
Copy-Item -LiteralPath (Join-Path $root 'native/third_party/7zip/COPYING-LGPL.txt') -Destination $tools -Force

# O windeployqt não copia o runtime C++ quando o terminal não está no Developer Prompt.
$vcRoots = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/2022/BuildTools/VC/Redist/MSVC'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio/2022/BuildTools/VC/Redist/MSVC'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio/2022/Community/VC/Redist/MSVC')
)
$crtSource = $null
foreach ($vcRoot in $vcRoots) {
    if (-not (Test-Path -LiteralPath $vcRoot)) { continue }
    $versions = Get-ChildItem -LiteralPath $vcRoot -Directory | Sort-Object Name -Descending
    foreach ($version in $versions) {
        $candidate = Join-Path $version.FullName 'x64/Microsoft.VC143.CRT'
        if (Test-Path -LiteralPath $candidate) { $crtSource = $candidate; break }
    }
    if ($crtSource) { break }
}
if ($crtSource) {
    Copy-Item -Path (Join-Path $crtSource '*.dll') -Destination $target -Force
} else {
    Write-Warning 'Runtime C++ (Microsoft.VC143.CRT) não encontrado; instale o VC++ Redistributable x64 na máquina de destino.'
}

Write-Host "Deploy concluído: $target"
# Identidade de canal: a pasta gerada pelo deploy é portátil e não cria instalador.
Set-Content -LiteralPath (Join-Path $target 'portable.marker') -Value 'portable=1' -Encoding ascii
Write-Host 'Valide em uma máquina/VM sem Qt, Node ou Visual Studio instalados.'
