## Contexto

O projeto começou sem código preexistente. A meta era criar um app desktop Windows para gerenciar bibliotecas de ROMs e inventário físico, usando LaunchBox como referência visual.

## Objetivos / Fora de Escopo

**Objetivos:**
- Estrutura Electron com `main`, `preload`, `renderer` e IPC seguro.
- Banco SQLite local.
- UI React com grade de box arts, lista e painel lateral.
- CRUD de jogos e plataformas.
- Associação de ROMs e importação de imagens.
- Integração com LaunchBox para metadados e mídia.
- Build Windows.

**Fora de Escopo:**
- Suporte multiplataforma.
- Emulação integrada.
- Sincronização em nuvem.
- Autenticação de usuário.

## Decisões

1. Usar Electron com `contextIsolation` e API segura via `window.gameStockAPI`.
2. Usar `better-sqlite3` no processo main para persistência local simples.
3. Compilar main/preload com `tsc` e renderer com Vite.
4. Manter schema SQLite simples, sem ORM.
5. Reaproveitar lógica do `launchbox-downloader` em TypeScript.
6. Emitir progresso de downloads por eventos IPC.

## Riscos / Trade-offs

- `better-sqlite3` exige rebuild nativo para Electron.
- `Metadata.zip` é grande e precisa de feedback visual.
- O schema flat facilita o MVP, mas pode exigir evolução futura.

## Perguntas em Aberto

- Tamanho ideal dos cards da grade.
- Configuração futura de emuladores por plataforma.
