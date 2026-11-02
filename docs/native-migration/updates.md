<!-- Updater assinado e distribuição via GitHub Releases (tarefas 10.2/10.3). -->
# Atualizações assinadas e distribuição pelo GitHub

O build é publicado manualmente em GitHub Releases. Não há CI: a chave privada fica no seu PC e
apenas a pública entra no código.

## Chave local

- Privada: `%USERPROFILE%\.gamestock\update-signing-key.json` (D/X/Y em base64), fora do repositório.
- Pública embutida em `native/src/update/UpdateConfig.h`:
  - X: `F/BMUYBe29wTBVtOMe9Brgw3fzjr8/2lyITnBGE+vGI=`
  - Y: `HybDPFyKg3e7uoVFyK7oxtSXDoJ8qLC4nMCoz9JoXww=`
- **Faça backup da chave privada.** Sem ela não é possível assinar novas releases aceitas por esta
  instalação.

## Feed

Asset fixo da última release:

`https://github.com/alexishida/games-stock/releases/latest/download/latest.json`

`latest.json` é um envelope:

```json
{ "schemaVersion": 1, "payload": "<base64 do JSON>", "signature": "<base64 ECDSA P-256 SHA-256>" }
```

O payload contém `version`, `buildNumber`, `releaseDate`, `notes`, `packageUrl` (HTTPS),
`fileName`, `size` e `sha256`. O app:

1. baixa o manifesto (limite 1 MiB) e verifica a assinatura **antes** de interpretar o payload;
2. compara versão com a instalada;
3. em instalação Windows, baixa o pacote em streaming;
4. confere tamanho e SHA-256;
5. só então inicia o instalador (`/S`) e encerra o app.

Portátil/desenvolvimento recebem `external-update`; Linux continua com atualização externa.

## Assinar uma release

```powershell
# 1. Gere o payload JSON apontando para o asset que será enviado ao GitHub
# 2. Assine localmente
powershell -ExecutionPolicy Bypass -File scripts/native-sign-update.ps1 `
  -PayloadPath update-payload.json -OutputPath latest.json
```

O script valida a assinatura com a própria chave antes de gravar. Publique `latest.json` e o
instalador como assets da mesma release. O app consulta `latest/latest.json` do GitHub.

## Splash e atualização manual (10.3)

- `SplashOverlay.qml` mostra fases `checking`, `downloading`, `applying`, `up-to-date`,
  `external-update`, `error` e `no-connection`, com barra, versão/notas e cartão arrastável.
- O check automático só roda em canal `installed` e fora de capturas; timeout de 30 s libera
  “Continuar offline”.
- Configurações → Sobre tem “Buscar atualização” e status/progresso manual.
- Em portátil, a mensagem orienta baixar o pacote publicado; não há execução in-place.

## Evidências (Windows, 03/11/2026)

```powershell
ctest --test-dir native/build/windows-msvc -C Release -R update-service --output-on-failure
```

- `update-service` cobre assinatura válida/adulterada, hash/tamanho divergentes, fluxo completo com
  feed HTTP local, execução do aplicador só após validação, canal portátil (`external-update`) e
  timeout de startup com modo offline.
- `native-sign-update.ps1` gerou `latest-sample.json` com a chave local e verificou a assinatura.
- Captura `update-splash.png` gerada com `--update-splash-preview`.
- QML `HardwareInventory.test_10_updateSplashAndManualCheck` cobre busca manual, splash, modo
  offline e posicionamento do cartão.

## Feeds, segredos e recuperação

- **Decisão de 03/11/2026:** o Qt é distribuído como instalação nova; não há ponte de atualização
  Electron→Qt nem `latest.yml` legado a manter. O lock comum permanece implementado para evitar
  abertura simultânea caso uma cópia Electron antiga seja executada no mesmo perfil.
- Feed nativo: `latest/latest.json` (assinado) + instalador na mesma release do GitHub.
- A chave privada **nunca** entra no repositório, no instalador ou nos assets. Fica em
  `%USERPROFILE%\.gamestock\update-signing-key.json` e deve ter backup offline.
- Verificação rápida antes de publicar:

```powershell
# Não deve retornar chaves privadas dentro do repositório
Get-ChildItem -Recurse -File -Exclude *.exe,*.dll,*.zip,*.png |
  Select-String -Pattern 'BEGIN (EC |RSA )?PRIVATE KEY|"d"\s*:' -List
```

- Falha de assinatura/hash/tamanho mantém a versão atual; o pacote parcial é apagado e o usuário pode
  baixar o instalador manualmente da release anterior.
- Perda da chave privada impede novas atualizações automáticas aceitas por instalações existentes;
  publique uma build com nova chave pública e oriente atualização manual.
- Sem CI: não há segredo de pipeline. A publicação no GitHub é manual e separada da implementação.

## Limitações

- O instalador ainda não é gerado neste repositório (10.7) e o Authenticode/SmartScreen é separado
  da assinatura do manifesto.
- A ponte NSIS/atualização Electron→Qt (10.4/10.5) e a publicação real no GitHub permanecem
  pendentes; a publicação é uma ação manual, não parte da implementação.
- Linux não executa o updater nativo nesta etapa.
