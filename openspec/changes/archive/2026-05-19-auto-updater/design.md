## Context

GameStock é um app Electron com processo main (Node.js) e renderer (React). A inicialização atual abre a `BrowserWindow` principal diretamente, sem nenhuma tela intermediária. Não há mecanismo de atualização: o usuário precisa baixar e instalar novas versões manualmente.

A proposta é adicionar uma splash screen que aparece antes da janela principal, verifica um endpoint JSON no servidor com metadados da versão mais recente, e — se necessário — baixa e aplica um pacote `.zip` com os novos arquivos do app.

`adm-zip` já está presente como dependência para o fluxo de portabilidade de dados. Nenhuma dependência nova de empacotamento é necessária.

## Goals / Non-Goals

**Goals:**
- Splash screen arrastável mostrada na abertura, com status em tempo real (verificando / baixando / aplicando / atualizado)
- Fetch do JSON de metadados remoto via `https` no processo main
- Comparação de versão semântica (local vs. remota)
- Download do `.zip` de atualização com barra de progresso no renderer
- Extração e substituição dos arquivos do app (recursos do Electron via `process.resourcesPath`)
- Relançamento do app após aplicar update (`app.relaunch` + `app.exit`)
- Bypass transparente quando já na versão atual (splash some e app abre normalmente)

**Non-Goals:**
- Uso de `electron-updater` / Squirrel / NSIS auto-update (mecanismo próprio)
- Atualização incremental / diff de arquivos (pacote completo)
- Suporte a rollback automático
- Assinatura criptográfica do pacote (fora de escopo neste momento)

## Decisions

### D1 — Splash como `BrowserWindow` separada (não modal React)

A splash precisa aparecer **antes** da janela principal existir. Modal React não é viável: não há janela pai ainda. A splash é uma `BrowserWindow` separada, pequena, sem frame (`frame: false`), sempre no topo, sem taskbar, centralizada na tela.

Alternativa descartada: mostrar a splash na própria janela principal antes de carregar o app. Exigiria um estado de "pré-boot" no renderer e atrasaria o carregamento do bundle principal.

### D2 — Lógica de update no processo main

Download, extração e substituição de arquivos são operações Node.js puras (`https`, `fs`, `adm-zip`). Rodar no renderer exigiria expor APIs de filesystem ao renderer — violação do modelo de segurança do app. Todo o fluxo fica em `src/main/updater.ts`.

### D3 — Comunicação splash ↔ main via IPC dedicado

A splash window é um renderer separado. O progresso do update (fase, porcentagem, mensagem de erro) é enviado do main para a splash via `webContents.send` nos canais `updater:status`. A splash pode enviar `updater:skip` se o usuário cancelar.

### D4 — Formato do JSON de metadados

```json
{
  "version": "1.2.0",
  "buildNumber": 42,
  "releaseDate": "2026-05-18",
  "downloadUrl": "https://example.com/releases/gamestock-1.2.0.zip",
  "releaseNotes": "Correções e melhorias"
}
```

Versão local lida de `app.getVersion()` (campo `version` do `package.json` empacotado).

### D5 — Aplicação do update via substituição de `resources/app`

Em builds Electron empacotados, os arquivos do app ficam em `process.resourcesPath/app` (ou `app.asar`). O `.zip` de update contém a estrutura `app/` que substitui esse diretório. O processo main extrai o zip para um diretório temporário, copia os arquivos sobre `resourcesPath`, então chama `app.relaunch()` + `app.exit(0)`.

**Risco**: arquivos em uso no Windows podem não ser substituíveis em runtime. Mitigation: extrair para pasta `_update_staging` ao lado de `resourcesPath`, relançar o app com flag `--apply-update <stagingPath>`, e o processo main ao detectar essa flag aplica a cópia antes de inicializar normalmente.

### D6 — URL do servidor de update via variável de ambiente / constante

A URL base do servidor é uma constante em `src/shared/update-config.ts`, substituível em build via `vite.config` (`define`). Isso permite trocar o endpoint sem recompilar o código (via `electron-builder` `extraMetadata`).

## Risks / Trade-offs

- **Substituição de arquivos no Windows com processo em execução** → Mitigation: staging + relaunch com flag `--apply-update` (D5)
- **Rede indisponível ao verificar update** → Mitigation: timeout curto (5s), falha silenciosa — app abre normalmente sem update
- **ZIP corrompido ou download incompleto** → Mitigation: verificar tamanho do arquivo baixado antes de extrair; em erro, abortar e abrir app normalmente
- **Usuário sem permissão de escrita em `resourcesPath`** → Mitigation: capturar erro de permissão e reportar na splash com opção de pular
- **Splash travada se main trava** → Mitigation: timeout máximo total de 30s na splash; se não receber sinal de conclusão, abre o app do jeito que está

## Migration Plan

1. Publicar JSON de metadados no servidor com a versão atual como baseline (sem mudança de versão = nenhum update disparado)
2. Deploy do app com splash habilitada
3. Próximo release: incrementar `version` no `package.json`, publicar novo `.zip` e JSON atualizado
4. Rollback: publicar JSON apontando para versão anterior (usuários na versão nova não serão rebaixados — comparação é `remota > local`)
