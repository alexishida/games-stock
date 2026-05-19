## Why

O GameStock não tem mecanismo de atualização automática. Usuários precisam baixar e instalar manualmente novas versões, o que resulta em instalações desatualizadas rodando bugs já corrigidos e sem acesso a novos recursos.

## What Changes

- Splash screen exibida na inicialização enquanto verifica versão disponível no servidor
- Lógica de comparação de versão local vs. versão remota via JSON de metadados
- Download do pacote `.zip` de atualização diretamente pelo app
- Substituição dos arquivos instalados com o conteúdo do pacote baixado
- Bypass do fluxo de atualização caso a versão já esteja atual (app abre normalmente)

## Capabilities

### New Capabilities

- `splash-screen`: Tela inicial de splash exibida na abertura do app com status de verificação de versão
- `auto-update`: Verificação, download e aplicação de atualizações via JSON de metadados remoto e pacote `.zip`

### Modified Capabilities

- `app-shell`: Inicialização do app agora passa pelo fluxo de splash + verificação antes de abrir a janela principal

## Impact

- **Main process**: novo módulo de update checker e downloader em `src/main/`
- **Renderer**: nova tela de splash em `src/renderer/`
- **IPC**: novos canais para comunicar progresso do update (check, download, apply)
- **Dependências**: `electron-updater` não será usado — o mecanismo é próprio via `https` + `adm-zip` (já presente)
- **Build**: o JSON de metadados precisa ser publicado junto com cada release no servidor
