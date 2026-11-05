<#
Executa o GameStock nativo com as DLLs do Qt no PATH e o perfil existente do usuário.
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
# Módulos QML locais independem de um deploy antigo ao lado do executável.
$env:QML_IMPORT_PATH = "$(Join-Path (Split-Path -Parent $qtBin) 'qml');$env:QML_IMPORT_PATH"
# O desenvolvimento usa a mesma ferramenta de extração local distribuída no pacote.
if (-not $env:GAMESTOCK_7Z_PATH) { $env:GAMESTOCK_7Z_PATH = Join-Path $root 'native/third_party/7zip/win/x64/7za.exe' }

# Sem --profile-dir o bootstrap resolve %APPDATA%/gamestock ou o override existente.
# Para testes, passe explicitamente um perfil sintético; nenhum dado é copiado silenciosamente.
$arguments = @($args)

& $executable @arguments
exit $LASTEXITCODE
