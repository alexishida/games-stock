<#
Remove logs e arquivos temporários de empacotamento gerados neste projeto.
Uso: powershell -NoProfile -ExecutionPolicy Bypass -File .\limpar-temporarios.ps1
Use -WhatIf para listar os itens antes da remoção.
Use -RemoverPreviews para também remover cópias locais de capturas e testes visuais antigos.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$RemoverPreviews)

$ErrorActionPreference = 'Stop'
$raiz = [IO.Path]::GetFullPath($PSScriptRoot)
$build = Join-Path $raiz 'native\build'
$staging = Join-Path $build 'package-staging'
$arquivos = @()

# Os diretórios ancestrais também precisam ser reais para a seleção permanecer no projeto.
foreach ($diretorio in @($raiz, (Join-Path $raiz 'native'), $build, (Join-Path $raiz 'release'), (Join-Path $raiz 'release\windows'))) {
    if (Test-Path -LiteralPath $diretorio) {
        $info = Get-Item -LiteralPath $diretorio -Force
        if ($info.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Diretório é um link: $diretorio" }
    }
}
if (Test-Path -LiteralPath $build -PathType Container) {
    $arquivos += @(Get-ChildItem -LiteralPath $build -File -Filter '*.log')
}
foreach ($relativo in @('aqtinstall.log', 'native\build\launch-diagnostic.txt', 'native\build\launch-error.txt', 'release\windows\gamestock-installer.nsi')) {
    $caminho = Join-Path $raiz $relativo
    if (Test-Path -LiteralPath $caminho -PathType Leaf) { $arquivos += Get-Item -LiteralPath $caminho -Force }
}

# Os previews são artefatos locais, mas podem conter capturas úteis para comparação visual.
$previews = @()
if ($RemoverPreviews) {
    foreach ($nome in @('launch-loading-preview', 'metadata-editor-preview', 'metadata-visual', 'page-navigation-preview', 'tooltip-preview')) {
        $caminho = Join-Path $build $nome
        if (-not (Test-Path -LiteralPath $caminho)) { continue }
        $resolvidoPreview = (Resolve-Path -LiteralPath $caminho).Path
        if ($resolvidoPreview -ne $caminho) { throw "Caminho de preview inesperado: $resolvidoPreview" }
        $conteudo = @((Get-Item -LiteralPath $caminho -Force)) + @(Get-ChildItem -LiteralPath $caminho -Force -Recurse)
        if ($conteudo | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw "Preview contém links: $caminho" }
        if ($conteudo | Where-Object { $_.Name -match '\.db($|-)' }) { throw "Preview contém banco de dados: $caminho" }
        $previews += $caminho
    }
}

# Recusar links impede que uma pasta temporária redirecionada apague dados externos.
foreach ($item in $arquivos) {
    if (-not $item.FullName.StartsWith($raiz + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Caminho inseguro: $($item.FullName)" }
}
if (Test-Path -LiteralPath $staging) {
    $resolvido = (Resolve-Path -LiteralPath $staging).Path
    if ($resolvido -ne $staging) { throw "Caminho de staging inesperado: $resolvido" }
    $itensStaging = @((Get-Item -LiteralPath $resolvido -Force)) + @(Get-ChildItem -LiteralPath $resolvido -Force -Recurse)
    if ($itensStaging | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Staging contém links; remoção cancelada.' }
    if ($itensStaging | Where-Object { $_.Name -match '\.db($|-)' }) { throw 'Staging contém banco de dados; remoção cancelada.' }
    # Uma instância em execução pode estar usando as DLLs dessa pasta.
    $emUso = Get-Process GameStock,gamestock_native -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and $_.Path.StartsWith($resolvido + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    }
    if ($emUso) { throw 'Feche o GameStock executado a partir de package-staging antes de limpar.' }
}

foreach ($item in $arquivos) {
    if ($PSCmdlet.ShouldProcess($item.FullName, 'Remover arquivo temporário')) {
        Remove-Item -LiteralPath $item.FullName -Force
        Write-Host "Removido: $($item.FullName)"
    }
}
if (Test-Path -LiteralPath $staging) {
    if ($PSCmdlet.ShouldProcess($staging, 'Remover pasta temporária de empacotamento')) {
        Remove-Item -LiteralPath $staging -Recurse -Force
        Write-Host "Removido: $staging"
    }
}
foreach ($preview in $previews) {
    if ($PSCmdlet.ShouldProcess($preview, 'Remover preview local antigo')) {
        Remove-Item -LiteralPath $preview -Recurse -Force
        Write-Host "Removido: $preview"
    }
}
Write-Host 'Limpeza concluída. Os releases, relatórios de testes e cache de compilação foram preservados.'
