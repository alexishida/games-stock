<!-- Consolidação de artefatos para revisão/corte; publicação é ação manual separada. -->
# Pacote local e evidências para o corte

Data: 03/11/2026 · Windows 11 · MSVC 2022 · Qt 6.8.3

## Artefatos gerados

| Artefato | Tamanho | SHA-256 |
|---|---|---|
| `artifacts/native-migration/dist-installer/GameStock-1.1.4-Setup.exe` | 22.243.621 B | `19D5250231BA19CA89FACAAE906533A17CB8BA2128EB82C64C431E3EC11EE3A4` |
| `artifacts/native-migration/dist-installer/GameStock-1.1.4-Portable.zip` | 32.553.170 B | `63467CC2FCDDC31FEF35E51D2E4DB0BD98D50E72AC0D865EBD821824D4B1B72E` |

Os artefatos são locais/ignorados pelo Git. A publicação no GitHub Releases é manual e separada da
implementação.

## Assinatura de atualização

- Feed: `https://github.com/alexishida/games-stock/releases/latest/download/latest.json`.
- Manifesto: envelope com payload base64 + assinatura ECDSA P-256/SHA-256.
- Chave privada: `%USERPROFILE%\.gamestock\update-signing-key.json` (fora do repositório).
- Chave pública: `native/src/update/UpdateConfig.h`.
- Assinatura local: `scripts/native-sign-update.ps1`.
- Nenhum segredo de CI é necessário. Faça backup offline da chave privada.

## Verificação executada

- CTest: **31/31** (`ctest -C Release --output-on-failure`), incluindo `portable-archive`,
  `backup-service`, `backup-coordinator`, `update-service`, `channel-identity`, `hardware-inventory`,
  `settings-service` e `libretro-media`.
- QML: **47/47** (`scripts/native-qml-test.ps1`), 6 arquivos.
- Typecheck Electron: executado antes do corte; o runtime e o script foram removidos em 11.5.
- ZIP64 real >4 GiB: teste opt-in aprovado (~21 s).
- Compatibilidade: fixture Electron→Qt e `native-backup-compat.cjs` Qt→Electron.
- Instalador: instalação silenciosa, execução sem Qt/Node no PATH, desinstalação e preservação do
  perfil verificadas (ver `installer.md`).
- Capturas: 31 estados em 9 combinações, com geometria e diferenças aceitas em
  [parity-audit.md](parity-audit.md).
- Benchmark de paginação, janela, memória e 1.200 ROMs em [benchmark.md](benchmark.md).
- Corte 11.5: build limpo em `native/build/clean-check`, portátil novo em
  `artifacts/native-migration/final-portable-check`, execução com `PATH=C:\Windows\System32;C:\Windows`
  e captura de Configurações → Backup. Nenhum arquivo Electron/React/Node no pacote.

## O que permanece

- Linux (build, capturas, `.deb`/AppImage) segue adiado por decisão do usuário.
- O backend compilado congelado em `tools/legacy-runtime/` permanece apenas para fixtures e
  compatibilidade; não entra no instalador.
- A publicação/distribuição externa continua manual e separada da implementação.

## Publicação manual (quando decidir publicar)

1. Gerar instalador/portátil com `scripts/native-installer.ps1`.
2. Calcular SHA-256 do instalador e montar o payload JSON da versão.
3. Assinar com `scripts/native-sign-update.ps1`, gerando `latest.json`.
4. Criar a release no GitHub e enviar instalador + `latest.json` como assets.
5. Validar em um perfil descartável que a instalação anterior detecta a nova versão.

Não publicar automaticamente a partir deste workspace.
