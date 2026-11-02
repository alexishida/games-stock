<!-- Plano incremental; cada tarefa inclui evidência de conclusão e não autoriza publicação. -->
# Tasks

> **Adiamento do Linux (01/11/2026):** por decisão do usuário, a implementação e a verificação no Linux ficam para depois. As tarefas abaixo são executadas e marcadas apenas no escopo Windows; toda etapa que exija build, captura, instalação ou teste no Linux continua pendente de retomada e está registrada em [docs/native-migration/linux-deferred.md](../../../docs/native-migration/linux-deferred.md).

## 1. Referencia e matriz de paridade

- [x] 1.1 Inventariar operações/eventos de gameStockAPI, telas e fluxos efetivos, incluindo logs, fontes de metadados e inventário; entregar matriz relacionando origem, destino e cenário de verificação.
- [x] 1.2 Registrar divergências entre código, specs e DESIGN.md e suas decisões, incluindo janela inicial e seções de configurações; verificar que cada divergência tem destino explícito.
- [x] 1.3 Criar fixtures sintéticas de banco legado/populado, mídias, emulador falso, jobs e backups das cinco categorias; verificar leitura no Electron sem usar dados reais.
- [x] 1.4 Capturar estados visuais de todas as telas e benchmark Electron em release com massa representativa; registrar ambiente, escalas, dados e comandos reproduzíveis.

## 2. Fundacao nativa

- [x] 2.1 Fixar Qt 6, compiladores, baseline Linux e dependências C++/ZIP64; entregar inventário de versões, licenças, módulos e requisitos de distribuição.
- [x] 2.2 Criar native/ com C++20, CMake/presets, módulos QML e testes; verificar configure/build/ctest em Windows e Linux sem alterar o build Electron existente.
- [x] 2.3 Implementar bootstrap, versão/build, ícone, geometria e logs; verificar mínimo, primeira abertura, restauração do JSON legado e monitor desconectado.
- [x] 2.4 Documentar comandos nativos e diagnóstico gráfico inicial; executar os comandos documentados e confirmar que o app de teste usa perfil isolado.

## 3. Prototipo e sistema visual

- [x] 3.1 Portar tokens para tema QML e preservar tipografia efetiva/ícones Lucide com licenças; comparar cores, pesos, tamanhos e assets com a referência.
- [x] 3.2 Reconstruir sidebar, busca, TopBar, paginação e cards/lista com fixtures; entregar capturas comparativas da tela principal nos dois sistemas.
- [x] 3.3 Implementar primitives de botões, campos e overlays arrastáveis/empilhados; verificar limites, foco, Escape, bloqueio do fundo e interação sem drag em controles.
- [x] 3.4 Validar blur de fundo, sombras, gradientes e transições no backend gráfico escolhido; entregar relatório visual e de custo, resolvendo diferenças antes de expandir telas.
- [x] 3.5 Comparar o protótipo na matriz de resoluções/escalas; verificar tokens idênticos, geometria dentro de 2 pixels lógicos e ausência de cortes, documentando diferenças de rasterização.

## 4. Persistencia e compatibilidade

- [x] 4.1 Portar resolução de caminhos e validação de mídia local; testar APPDATA/XDG, override, espaços, acentos, traversal e symlink externo.
- [x] 4.2 Implementar conexão QSQLITE por thread, schema, função/filtro de gênero e DAOs; verificar foreign keys, timeout e equivalência de consultas paginadas/contagens nas fixtures.
- [x] 4.3 Portar migrations/seeds com identificadores existentes; testar banco limpo, schemas antigos, reabertura idempotente e preservação de IDs/relacionamentos.
- [x] 4.4 Implementar snapshot consistente e recuperação de falha de migration; testar banco com WAL, falha de backup, rollback transacional e schema futuro recusado.
- [x] 4.5 Portar app_state, pastas e formatos de jobs; verificar campos ausentes, running convertido em interrupted e dispensa persistente.
- [x] 4.6 Implementar contrato de lock comum para as versões de transição e detecção de instância Electron antiga; comprovar bloqueio de acesso concorrente ao perfil.
- [x] 4.7 Documentar diretórios, política de migration e recuperação; executar o procedimento de retorno em uma cópia de perfil, sem sobrescrever dados novos implicitamente.

## 5. Servicos e biblioteca completa

- [x] 5.1 Expor serviços tipados de jogos/plataformas e modelos paginados; verificar CRUD, validação, filtros combinados, gêneros, contagens e agrupamento de variantes contra a matriz.
- [x] 5.2 Completar detalhe, formulário manual/edição, exclusão, favorito/status e seleção de versões em QML; verificar persistência, navegação entre páginas, erros e comparação visual.
- [x] 5.3 Implementar gerenciamento de plataformas, aliases, extensões e categorias; testar bloqueios de exclusão, defaults e atualização da sidebar.
- [x] 5.4 Implementar preferências independentes de cards/lista, busca e ordenação por coleção; verificar alternância biblioteca/inventário sem interferência.
- [x] 5.5 Documentar a fronteira de serviços/modelos e atualizar a matriz com evidências; verificar que QML não contém SQL nem execução genérica de comandos.

## 6. Emuladores e execucao

- [x] 6.1 Portar cadastro, vínculos, padrão por plataforma e inventário de cores RetroArch; testar duplicidade, core manual/fallback, PATH e caminhos relativos/absolutos.
- [x] 6.2 Portar extração/cache de ROMs e lançamento com argumentos separados; testar ZIP/7z, espaços/acentos, processos falsos, falhas e incremento de launch_count somente no sucesso.
- [x] 6.3 Reconstruir telas de emuladores, associações e histórico de partidas; verificar seletores nativos, loading e fidelidade visual.
- [x] 6.4 Documentar dependências de extração e regras de execução por SO; repetir o smoke com o emulador falso em Windows e Linux.

## 7. Metadados e jobs

- [x] 7.1 Implementar registro compartilhado de jobs e workers com sinais enfileirados; testar UI responsiva, fechamento seguro e persistência apenas nas transições.
- [x] 7.2 Portar download, XML incremental e cache LaunchBox; testar cache recente, corrompido, operações simultâneas, erro de rede e reconstrução idempotente.
- [x] 7.3 Portar busca/matching e integrações OpenVGDB/libretro existentes; comparar resultados, ambiguidades e fallbacks com fixtures determinísticas da matriz.
- [x] 7.4 Portar mídia e previews de capas; verificar região prioritária, orientação, dimensões, JPEG 85, ausência de ampliação e reaproveitamento dos arquivos existentes.
- [x] 7.5 Portar scan/importação de ROMs, detecção automática e remoção de registros por pasta; testar subpastas, extensões ambíguas, variantes e preservação dos arquivos físicos.
- [x] 7.6 Reconstruir importadores, revisão, sincronização de mídia e NotificationCenter; verificar progresso/resumos, retomada e dispensa após reinício, com comparação visual.
- [x] 7.7 Documentar jobs, cache e diagnóstico; comprovar execução de um lote grande sem escrita SQLite por tick e sem bloquear interações da UI.

## 8. Inventario e configuracoes

- [x] 8.1 Portar serviços/DAOs de itens, tipos, conservação e fotos; testar todas as regras existentes de hardware-inventory, preservando vínculos e imagens.
- [x] 8.2 Reconstruir cards/lista, detalhe e formulário de inventário; verificar filtros, seleção de fotos, CRUD e capturas comparativas.
- [x] 8.3 Completar configurações, capas, partidas, logs e Sobre, incluindo estatísticas e ações atuais; verificar cada entrada da matriz e comparar telas/estados de erro.
- [x] 8.4 Documentar componentes e estado compartilhado nativo; validar navegação entre seções enquanto jobs estão ativos sem perder progresso.

## 9. Portabilidade

- [x] 9.1 Implementar leitura/escrita ZIP/ZIP64 e manifesto schemaVersion 1; testar STORED/DEFLATED, pacote maior que 4 GiB gerado para teste e limites de recursos.
- [x] 9.2 Portar preview/exportação das cinco categorias e matching de importação; verificar Electron exporta/Qt importa e Qt exporta/Electron importa sem duplicar entidades.
- [x] 9.3 Implementar staging de mídias e rollback coordenado com SQLite; testar falha de disco, pacote inválido, ZIP traversal/symlinks e preservação de arquivos preexistentes.
- [x] 9.4 Reconstruir UI de backup com progresso, avisos e confirmação; verificar fidelidade, seleção vazia bloqueada e retomada/interrupção conforme contrato.
- [x] 9.5 Documentar compatibilidade e recuperação dos backups; executar restauração completa em perfil vazio e populado usando o procedimento documentado.

## 10. Atualizacao e distribuicao

- [x] 10.1 Implementar identidade de canal instalado/portátil e build Windows/Linux com dependências Qt; verificar abertura em ambientes limpos sem Node/Qt de desenvolvimento.
- [x] 10.2 Implementar manifesto nativo assinado, verificação de pacote e updater C++; testar assinatura inválida, hash/tamanho divergente, download incompleto e ausência de execução de pacote recusado.
- [x] 10.3 Reconstruir splash e atualização manual; verificar fases, arraste, modo offline, timeout de 30 segundos e update externo para Linux/portátil.
- [x] 10.4 Preparar release Electron de transição com migração localStorage para app_state e lock comum; testar perfil com configurações exclusivamente legadas sem exigir recadastro. *(Não aplicável: decisão de 03/11/2026 distribui o Qt como instalação nova; a migração localStorage já existente no Electron permanece documentada.)*
- [x] 10.5 Gerar ponte NSIS e metadados legados por tooling compatível; testar atualização Electron para Qt, identidade/desinstalação, falha de instalação e continuidade dos dados em VM descartável. *(Não aplicável: não há base Electron instalada a migrar; instalador NSIS Qt e teste de instalação/desinstalação foram feitos em 10.7.)*
- [x] 10.6 Documentar feeds, assinatura, segredos de CI e recuperação; verificar que pacotes e repositório não contêm chaves privadas e que os feeds legados permanecem atendidos no corte.
- [x] 10.7 Gerar instalador/portátil Windows e .deb/AppImage Linux em release/; verificar instalação, execução, desinstalação e preservação do perfil em cada formato.

## 11. Paridade e corte

- [x] 11.1 Executar matriz funcional completa e comparação visual de todas as telas nas resoluções/escalas previstas; entregar relatório sem falhas de paridade pendentes. *(31 telas em 9 combinações; geometria aprovada e diferenças aceitas em parity-audit.md.)*
- [x] 11.2 Comparar builds release Electron/Qt na mesma máquina e massa; registrar inicialização, memória, paginação e imports sem afirmar ganhos não medidos.
- [x] 11.3 Executar CTest, testes QML/integração, análise estática e sanitizers suportados, além dos checks Electron enquanto coexistir; entregar resultados e corrigir regressões de recursos/threads. *(Windows: CTest 31/31, QML 47/47 e `npm run typecheck`; o preset MSVC não habilita sanitizers/análise estática dedicada e o Linux segue adiado — limitação registrada.)*
- [x] 11.4 Atualizar README, regras técnicas, scripts e purposes das specs para C++/QML; verificar ausência de instruções Electron obsoletas no fluxo oficial e documentação em pt-br.
- [x] 11.5 Retirar código/dependências do runtime legado após cumprir os critérios de corte, preservando fixtures e ferramentas de compatibilidade necessárias; verificar build limpo e pacote final independente de Electron/React/Node. *(src Electron/React removido; backend congelado em tools/legacy-runtime para fixtures; build limpo e portátil executados sem Qt/Node no PATH.)*
- [x] 11.6 Consolidar artefatos e evidências de recuperação/atualização para revisão; confirmar que publicação/distribuição externa permanece uma ação separada da implementação.


