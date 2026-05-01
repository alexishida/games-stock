## 1. Modelo de Dados e Contratos

- [x] Adicionar migrações para `games.favorite` e `games.play_status`.
- [x] Atualizar tipos compartilhados de jogo, filtros e ordenação.
- [x] Atualizar canais IPC e eventos de menu.

## 2. Repositório de Jogos

- [x] Atualizar criação, atualização, normalização e upsert LaunchBox.
- [x] Suportar filtros de favoritos, concluídos e não jogados.
- [x] Suportar ordenação por título, ano e recentes.
- [x] Verificar comportamento de exclusão.

## 3. Estado e Hooks do Renderer

- [x] Adicionar filtro de coleção, ordenação e estados de modais.
- [x] Atualizar hooks para enviar filtros ao IPC.
- [x] Recarregar biblioteca após importações, criação, edição e exclusão.

## 4. UI de Gerenciamento Manual

- [x] Criar modal de jogo manual.
- [x] Ligar ação visível de adicionar jogo.
- [x] Adicionar exclusão com confirmação.
- [x] Adicionar controles de favorito e status.
- [x] Persistir remoção de ROM.

## 5. UI de Plataformas

- [x] Criar modal de gerenciamento de plataformas.
- [x] Criar e editar plataformas.
- [x] Excluir plataformas com confirmação e erro visível.
- [x] Atualizar biblioteca após mudanças.

## 6. Filtros, Ordenação e Menus

- [x] Substituir tabs placeholder por filtros reais.
- [x] Substituir ordenação placeholder por ordenação real.
- [x] Conectar menus nativos aos eventos do renderer.
- [x] Manter controles sincronizados pelo store.

## 7. Verificação

- [x] Rodar build do renderer.
- [x] Rodar build do main.
- [x] Verificação manual dos fluxos principais.
