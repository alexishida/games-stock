## Contexto

O GameStock já conseguia importar jogos individuais pelo LaunchBox, mas ainda não tratava pastas inteiras de ROMs. A mudança adicionou um fluxo parecido com assistentes de importação clássicos: selecionar pasta, escolher plataforma, revisar ROMs e iniciar processamento em background.

## Objetivos / Fora de Escopo

**Objetivos:**
- Importar múltiplas ROMs de uma pasta.
- Usar uma plataforma selecionada para todo o lote.
- Baixar box art, background e screenshot.
- Atualizar jogos existentes sem duplicar.
- Mostrar progresso em notificações.
- Permitir continuar downloads depois.
- Permitir remover uma pasta do GameStock sem apagar arquivos físicos.

**Fora de Escopo:**
- Leitura interna de metadados complexos de ROMs compactadas.
- Curadoria manual de cada match antes da importação.
- Emulação ou execução de ROMs.

## Decisões

1. Usar scan simples por extensão suportada.
2. Derivar título candidato do nome do arquivo.
3. Filtrar o índice LaunchBox pela plataforma selecionada.
4. Reutilizar contexto de match em lote para performance.
5. Rodar importação em background após a revisão.
6. Exibir progresso pelo centro de notificações.
7. Salvar imagens em pastas por plataforma e jogo.
8. Excluir registros da biblioteca por `rom_path`, preservando a pasta física.

## Riscos / Trade-offs

- Matches automáticos podem falhar para nomes muito diferentes.
- Pastas grandes exigem cache e reaproveitamento do índice.
- Registros antigos sem `rom_path` exigem fallback por título e plataforma.
