## 1. Estrutura do Projeto

- [x] Criar `package.json`, TypeScript, Vite e Electron Builder.
- [x] Criar estrutura `src/main`, `src/preload`, `src/renderer` e `src/shared`.
- [x] Configurar scripts de desenvolvimento, build e distribuição.

## 2. IPC e Banco de Dados

- [x] Criar canais IPC compartilhados.
- [x] Inicializar SQLite em `%APPDATA%/GameStock`.
- [x] Criar tabelas de jogos e plataformas.
- [x] Expor CRUD de jogos e plataformas.

## 3. Interface da Biblioteca

- [x] Criar app React com layout principal.
- [x] Implementar painel lateral de plataformas.
- [x] Implementar grade e lista de jogos.
- [x] Implementar busca, filtros e seleção.

## 4. Detalhes, ROMs e Inventário

- [x] Criar painel de detalhes do jogo.
- [x] Associar e abrir ROMs.
- [x] Importar box art local.
- [x] Marcar posse física e condição.

## 5. LaunchBox

- [x] Baixar e cachear `Metadata.zip`.
- [x] Construir índice de jogos.
- [x] Buscar jogos no índice.
- [x] Baixar imagens por tipo.
- [x] Importar jogos com metadados e capa.

## 6. Verificação

- [x] Rodar build do renderer.
- [x] Rodar build do main.
- [x] Rodar smoke/e2e do importador LaunchBox.
