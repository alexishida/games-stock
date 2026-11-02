<#
Assina um payload JSON e gera latest.json para GitHub Releases.
A chave privada NÃO fica no repositório; padrão: $HOME/.gamestock/update-signing-key.json.
Uso:
  powershell -ExecutionPolicy Bypass -File scripts/native-sign-update.ps1 -PayloadPath update-payload.json -OutputPath latest.json
#>
param(
    [Parameter(Mandatory = $true)][string]$PayloadPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$KeyPath = (Join-Path $HOME '.gamestock/update-signing-key.json')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $PayloadPath)) { throw "Payload não encontrado: $PayloadPath" }
if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "Chave privada não encontrada em $KeyPath. Gere uma chave local antes de assinar."
}

$payloadBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $PayloadPath).Path)
$data = Get-Content -LiteralPath $KeyPath -Raw | ConvertFrom-Json
$curve = [System.Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256')
$parameters = New-Object System.Security.Cryptography.ECParameters
$parameters.Curve = $curve
$parameters.D = [Convert]::FromBase64String($data.d)
$point = New-Object System.Security.Cryptography.ECPoint
$point.X = [Convert]::FromBase64String($data.x)
$point.Y = [Convert]::FromBase64String($data.y)
$parameters.Q = $point
$ecdsa = [System.Security.Cryptography.ECDsa]::Create($curve)
$ecdsa.ImportParameters($parameters)
$signature = $ecdsa.SignData($payloadBytes, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
# Verifica com a própria chave antes de publicar; um erro de assinatura não passa silencioso.
if (-not $ecdsa.VerifyData($payloadBytes, $signature, [System.Security.Cryptography.HashAlgorithmName]::SHA256)) {
    throw 'Assinatura gerada não pôde ser verificada.'
}
$envelope = [ordered]@{
    schemaVersion = 1
    payload = [Convert]::ToBase64String($payloadBytes)
    signature = [Convert]::ToBase64String($signature)
}
$json = $envelope | ConvertTo-Json -Compress
Set-Content -LiteralPath $OutputPath -Value $json -Encoding ascii
"latest.json gerado: $OutputPath"
"chave pública X: $($data.x)"
"chave pública Y: $($data.y)"
