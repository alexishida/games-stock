## 1. Modelo de Dados e Contratos

- [x] Adicionar `background_path` e `screenshot_path`.
- [x] Atualizar tipos compartilhados de jogos e importação.
- [x] Expor IPCs e progressos de importação por pasta.

## 2. Descoberta de ROMs

- [x] Implementar seleção nativa de pasta.
- [x] Escanear extensões suportadas.
- [x] Normalizar título a partir do arquivo.
- [x] Retornar caminho absoluto, nome, título candidato e plataforma.

## 3. Match LaunchBox e Download de Mídia

- [x] Criar match em lote por título e plataforma.
- [x] Marcar candidatos como encontrados, ambíguos ou sem match.
- [x] Baixar box art, background e screenshot.
- [x] Reutilizar imagens já existentes.
- [x] Emitir progresso por estágio.

## 4. Upsert da Biblioteca

- [x] Criar ou atualizar jogos sem duplicar.
- [x] Salvar `rom_path` e caminhos de mídia.
- [x] Preservar sucessos quando outros candidatos falham.
- [x] Retornar resumo final.

## 5. Fluxo do Renderer

- [x] Criar assistente de importação por pasta.
- [x] Mostrar ROMs descobertas antes de iniciar.
- [x] Rodar importação em background.
- [x] Mostrar notificações de progresso.
- [x] Atualizar biblioteca ao concluir.

## 6. Melhorias de Fluxo

- [x] Tela inicial com tabela de pastas em uso.
- [x] Botões de adicionar, deletar e continuar downloads.
- [x] Plataforma selecionada na tela de configuração.
- [x] Janela fecha ao iniciar background.

## 7. Performance e Correções

- [x] Reutilizar contexto de match em lote.
- [x] Evitar match de `NES` com `Genesis`.
- [x] Deletar registros da pasta sem apagar a pasta física.
- [x] Lidar com registros antigos sem `rom_path`.
- [x] Salvar imagens em `images/<platform>/<game>/`.

## 8. Verificação

- [x] Rodar build do main.
- [x] Rodar build do renderer.
- [x] Rodar smoke test de importação por pasta.
- [x] Validar OpenSpec.
