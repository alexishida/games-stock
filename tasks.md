<!-- Plano de otimização: medir com dados sintéticos e preservar bancos existentes. -->
# Otimização de desempenho

Os pontos abaixo são oportunidades identificadas na análise do código. Medir o impacto antes e depois com perfis sintéticos, preservando dados de instalações existentes, aparência e comportamento.

## Medição inicial

- [ ] **Ponto encontrado:** faltam medições comparáveis para as operações abaixo em bibliotecas de tamanhos diferentes.
  **Melhoria proposta:** registrar ambiente, fixtures, tempo de abertura, busca, rolagem, importação, memória e empacotamento; repetir as medições após as mudanças.

## Miniaturas do inventário — prioridade alta

- [ ] **Ponto encontrado:** os cards carregavam imagens sem solicitar tamanho de decodificação. Arquivo: `native/qml/components/HardwareItemCard.qml`.
  **Melhoria proposta:** solicitar miniaturas proporcionais ao tamanho exibido e à densidade da tela. A implementação inicial foi feita; comparar nitidez, tempo e memória com imagens grandes e diferentes escalas antes de concluir.

## Capas da biblioteca — prioridade alta

- [ ] **Ponto encontrado:** os cards podem carregar capas maiores que a área visível; o layout usa as dimensões da imagem para distinguir capas horizontais e verticais. Arquivo: `native/qml/components/GameCard.qml`.
  **Melhoria proposta:** solicitar imagens reduzidas preservando proporção, orientação e recorte. Validar capas horizontais e verticais, alta densidade, aparência e memória.

## Inventário na thread da interface — prioridade alta

- [ ] **Ponto encontrado:** busca, filtros e paginação consultam o banco na thread da interface; adicionar foto também copia o arquivo nessa thread. Arquivo: `native/src/services/InventoryService.cpp`.
  **Melhoria proposta:** mover leituras para um worker e cópias para um job, mantendo conexões SQLite na thread que as criou. Descartar resultados antigos, preservar progresso e erros e medir responsividade com bancos e fotos grandes.

## Contagens e paginação da biblioteca — prioridade alta

- [ ] **Ponto encontrado:** cada consulta de página calcula contagens distintas e executa agrupamento e ordenação antes do limite. Arquivos: `native/src/db/dao/GameReadDao.cpp` e `native/src/services/LibraryQueryWorker.cpp`.
  **Melhoria proposta:** medir planos SQLite e custo com filtros e catálogos grandes; cachear contagens com invalidação após alterações relevantes. Avaliar índices ou outra seleção dos representantes de cada grupo sem mudar resultados, ordenação ou compatibilidade.

## Busca LaunchBox — prioridade média

- [ ] **Ponto encontrado:** cada busca percorre o índice e normaliza plataformas, títulos e aliases; as correspondências são ordenadas antes de aplicar o limite. A busca já ocorre em background. Arquivos: `native/src/launchbox/LaunchBoxSearch.cpp` e `native/src/services/MetadataService.cpp`.
  **Melhoria proposta:** pré-calcular textos normalizados, organizar candidatos por plataforma e reduzir a ordenação. Preservar aliases, prioridade de resultados exatos, ordenação e limite; medir tempo e memória.

## Downloads de mídia — prioridade média

- [ ] **Ponto encontrado:** as imagens são baixadas sequencialmente. Arquivo: `native/src/launchbox/LaunchBoxMedia.cpp`.
  **Melhoria proposta:** avaliar uma fila com 2 a 4 downloads simultâneos, preservando cancelamento, progresso, falhas individuais, integridade dos arquivos e limites do serviço. Comparar tempo e recursos utilizados.

## Cards e efeitos visuais — prioridade média

- [ ] **Ponto encontrado:** as grades usam `Repeater` para criar os cards da página, e cada card pode usar camadas e efeitos gráficos. Arquivos: `native/qml/Main.qml`, `native/qml/components/HardwareInventoryPage.qml` e `native/qml/components/GameCard.qml`.
  **Melhoria proposta:** medir quadros, memória e tempo de criação; avaliar `GridView`, reutilização de delegates e redução de camadas. Preservar aparência, rolagem, foco, acessibilidade e navegação; comparar capturas.

## Estatísticas de armazenamento — prioridade baixa

- [ ] **Ponto encontrado:** após o prazo do cache, calcular o tamanho do perfil percorre novamente seus arquivos. A varredura já ocorre em background. Arquivo: `native/src/services/SettingsService.cpp`.
  **Melhoria proposta:** medir o custo em perfis grandes e avaliar atualização sob demanda ou totais por categoria com invalidação. Preservar correção para alterações externas dos arquivos.

## Empacotamento — prioridade média para desenvolvimento

- [ ] **Ponto encontrado:** instalador e ZIP portátil são gerados em sequência; uma execução anterior gastou cerca de 64 segundos nessa etapa. Arquivo: `scripts/native-installer.ps1`.
  **Melhoria proposta:** permitir gerar cada formato separadamente e comparar compressão, tempo e tamanho final. Preservar o formato distribuído e validar o conteúdo. O modo `-BuildOnly` já evita o empacotamento durante o desenvolvimento.

## Validação final

- [ ] **Ponto encontrado:** as melhorias precisam demonstrar ganhos reais e manter fluxos e dados existentes.
  **Melhoria proposta:** executar testes pertinentes, comparar capturas de mudanças visuais e registrar medições antes/depois. Validar instalações limpas e bancos sintéticos anteriores; usar migrations e backfills quando necessários, sem reset ou reimportação.
