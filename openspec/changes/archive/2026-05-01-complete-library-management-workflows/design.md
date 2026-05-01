## Contexto

O aplicativo já possuía base funcional em Electron/React, persistência SQLite, importador LaunchBox, repositórios de jogos/plataformas e visualizações em grade/lista. A mudança completou controles que ainda eram placeholders ou acessíveis apenas pelo código.

## Objetivos / Fora de Escopo

**Objetivos:**
- Permitir criar e excluir jogos.
- Permitir gerenciar plataformas pela UI.
- Persistir remoção de ROM.
- Adicionar favoritos e status de jogo.
- Aplicar filtros e ordenações reais.
- Sincronizar menu nativo e controles visuais.

**Fora de Escopo:**
- Lançamento de emuladores.
- Escaneamento de ROMs em lote.
- Nuvem, contas ou múltiplas bibliotecas.
- Substituir a camada SQLite existente.

## Decisões

1. Guardar `favorite` e `play_status` na tabela `games`.
2. Estender `games.list(filters?)` em vez de criar endpoints separados.
3. Usar modais para criação manual e gerenciamento de plataformas.
4. Enviar eventos do menu nativo para o renderer.
5. Fazer `Remover ROM` persistir imediatamente.

## Riscos / Trade-offs

- Bancos existentes precisavam de migrações idempotentes.
- Mais filtros poderiam confundir contagens, então `total` e `filtered` foram mantidos separados.
- Exclusão de plataforma precisa mostrar erro quando houver jogos associados.
