<!-- Decisões técnicas e critérios para uma migração sem perda de dados ou identidade visual. -->
# Design

## Context

Ver `proposal.md` para motivação e escopo. O runtime atual é Electron, React/TypeScript, Zustand e SQLite via better-sqlite3. A API do preload concentra operações de domínio; não é um contrato público que precise sobreviver como JavaScript.

O SQLite contém também `app_state` e `schema_migrations`; as migrations existentes incluem saneamento e backfills. A portabilidade real inclui cinco categorias (`inventoryImages` além das quatro descritas em partes da documentação) e implementação ZIP64. O código e as specs atuais devem ser inventariados juntos: há divergências, como tamanho inicial da janela (1122x957 no código e 1225x818 na spec), seções de configurações e detalhes de persistência. Registrar a decisão de cada divergência antes de portar; para a janela, esta proposta adota o comportamento atual 1122x957.

## Goals / Non-Goals

**Goals:**
- Runtime final independente de Electron, Node.js, React, navegador e WebView, com UI Qt Quick e serviços C++.
- Paridade visual, funcional e de persistência comprovada em Windows e Linux.
- Transição por entregas verificáveis, mantendo uma versão Electron utilizável até o corte.

**Non-Goals:**
- Redesenhar a marca, reorganizar fluxos, adicionar plataformas ou obrigar o usuário a reimportar dados.
- Prometer redução de recursos sem benchmark, reescrever ROMs/emuladores ou trocar o schema por conveniência.
- Usar Rust, hospedar React em Qt WebEngine ou manter backend Node como dependência final.

## Decisions

### 1. C++20, Qt 6 Quick/QML e CMake em `native/`

Criar `native/CMakeLists.txt`, presets, `src/{app,domain,services,db,models,jobs}` e `qml/{theme,components,screens}`. Fixar uma versão Qt 6 e toolchains compatíveis com Windows 11 e o baseline Linux definido na primeira etapa; registrar dependências e licenças. Preferir Qt Core, Gui, Qml, Quick, QuickControls2, Sql, Network e Test, evitando módulos GPL-only sem decisão explícita sobre distribuição. Usar vínculo dinâmico quando aplicável à opção LGPL e documentar os materiais necessários à redistribuição; isso não dispensa verificar a licença de cada módulo e asset.

Qt Quick é escolhido pelo controle sobre layout e efeitos do design atual. Qt Widgets exigiria mais trabalho para a identidade visual; Rust/Iced é viável, mas não é a stack escolhida. QML pode conter expressões e handlers próprios da linguagem, sem dependência de Node/npm no aplicativo distribuído.

### 2. Serviços e modelos tipados substituem IPC

Expor façadas QObject estreitas por domínio e QAbstractListModel para listas. Manter DTOs explícitos, validação no serviço e erros acionáveis. Não expor conexões SQL, execução arbitrária de shell ou acesso irrestrito ao filesystem em QML. Criar uma matriz que associe cada operação de `gameStockAPI`, evento e tela ao serviço/modelo nativo e à verificação de paridade. Os nomes antigos de operações/eventos citados nas specs representam contratos lógicos; não exigem recriar Electron IPC.

SQL permanece em `native/src/db/dao`, repositórios são fachadas/orquestração e QML não executa SQL. Qt SQL/QSQLITE é a opção inicial; portar a função SQLite `library_has_genre` ou provar equivalência de consulta sem carregar a biblioteca inteira. Usar parâmetros nas queries e preservar filtros, agrupamento de variantes, ordenação, contagens e paginação.

### 3. Dados existentes têm precedência sobre defaults do Qt

Resolver exatamente `GAMESTOCK_USER_DATA_DIR`, `%APPDATA%/gamestock` e `$XDG_DATA_HOME/gamestock` ou `~/.local/share/gamestock`. Não adotar cegamente QStandardPaths, que pode escolher outro diretório. Preservar `gamestock.db`, IDs e vínculos locais, `schema_migrations`, `app_state`, imagens, fotos, cache e `window-bounds.json`. Manter foreign keys, timeout de concorrência e transações. Cada conexão SQL pertence à thread que a utiliza.

Portar schema, seeds e migrations com os mesmos identificadores e comportamento idempotente. Só adicionar migrations incrementais se indispensáveis. Antes de qualquer migration nova, produzir snapshot consistente via mecanismo de backup SQLite, nunca copiar apenas o arquivo principal de um banco aberto com WAL. Falha de backup ou migration bloqueia escrita e informa erro; não cria biblioteca vazia alternativa. Bibliotecas de schemas futuros são recusadas de forma explícita, sem modificação.

Usar fixtures/cópias nos testes. Impedir abertura concorrente por Electron e Qt com protocolo comum de lock implantado antes do corte, além da proteção de transações. Não prometer que QLockFile sozinho impeça um Electron antigo: incluir ponte Electron que respeita o lock e verificação dos processos legados antes de acessar o perfil real. Retorno de versão só é garantido com schema compatível; senão exige restauração explícita do snapshot e explicação de que alterações posteriores não estão nele.

Entradas antigas ainda exclusivas do localStorage devem ser exportadas pela ponte Electron para `app_state` antes da troca, sem pedir recadastro. Nunca tentar interpretar diretamente o LevelDB do Chromium em Qt.

### 4. Fidelidade visual como critério de entrega

Extrair tokens do DESIGN.md e medidas/estados efetivos do CSS para um tema QML central. Preservar a tipografia efetiva do renderer (Segoe UI/system-ui/Arial por SO) e assets existentes com suas licenças; o código atual não carrega Inter apesar do guia. A sidebar permanece em 240px, conforme CSS atual. Ver docs/native-migration/decisions.md para a decisão completa. Substituir `lucide-react` por assets SVG Lucide locais equivalentes; essa é uma exceção deliberada à regra React de ícones para o novo runtime. Não criar uma família visual diferente.

Primeiro protótipo: sidebar, busca de 34px, ordenação, contador, cards/lista, paginação, detalhes básicos e um modal empilhado/arrastável. Comparar capturas do Electron e Qt com fixtures idênticas em 1122x957, mínimo 1024x768 e 1920x1080, escala 100%, 125% e 150%. Automatizar medições e registrar diferenças: cores/tokens iguais; geometria dos componentes estáticos com diferença máxima de 2 pixels lógicos; nenhum texto cortado, overlay escapando ou controle inacessível. Rasterização de fontes pode variar e deve ser isolada no relatório, sem esconder diferenças de layout.

Validar separadamente sombras, gradientes, blur de fundo e animações no backend gráfico de cada SO; desfoque do próprio elemento não equivale a backdrop blur. Se precisar shader/captura de fundo, implementá-lo e medir custo no protótipo. Se não atingir fidelidade, registrar a limitação e resolver antes de expandir a migração; não substituir silenciosamente o efeito por um painel sólido.

Usar overlays dentro da janela principal para formulários e confirmações. Drag ignora controles interativos, fica limitado à janela e preserva centralização inicial, escurecimento por camada e ações à direita. Seletores de arquivo/pasta continuam nativos. Reproduzir teclado, foco, Escape, loading, estados vazios, erros e navegação. O protótipo é um marco de comparação revisável, sem exigir confirmação extra do usuário para prosseguir com implementação já autorizada.

### 5. Jobs fora da thread da UI

Usar workers/QtConcurrent conforme o tipo de tarefa e sinais enfileirados para atualizar modelos na thread gráfica. O registro de jobs no backend é a fonte compartilhada do estado, substituindo Zustand. Persistir início, fim/falha e dispensa, sem SQLite a cada tick; ao reiniciar, `running` vira `interrupted`. Retomada é idempotente, respeita mídia já existente e não duplica entidades. Encerramento aguarda ou interrompe trabalhos de forma controlada, sem callbacks para objetos destruídos.

Downloads usam Qt Network; parser XML incremental substitui xml2js; imagens usam APIs Qt ou dependência justificada que preserve orientação, dimensões, região e qualidade previstas. Selecionar uma biblioteca ZIP/ZIP64 mantida após avaliar licenças, limites de extração e fixtures; usar 7-Zip para formatos de ROM necessários quando justificado, com processo e argumentos separados. Incluir fontes OpenVGDB/libretro, resolução de executáveis, RetroArch e outros comportamentos efetivamente presentes no inventário de paridade.

### 6. Portabilidade e mídia não mudam de contrato

Reutilizar `.gamestock-backup` schemaVersion 1, manifesto e payloads, todas as cinco categorias, STORED/DEFLATED e ZIP64. Testar Electron exporta/Qt importa e Qt exporta/Electron importa. Não serializar IDs locais como identidade externa. Preservar matching por nomes/plataforma/LaunchBox e as regras próprias do inventário.

Importação é transacional com staging de mídias e rollback/limpeza em falhas. Validar caminhos canônicos, symlinks, limites, espaço livre e entradas ZIP para impedir escape de diretório. Expor mídia por image provider controlado ou equivalente; não depender do protocolo Chromium. Preservar imagens já existentes e referências persistidas.

### 7. Distribuição e ponte de atualização

Manter scripts Electron existentes durante a migração e adicionar comandos CMake documentados. Gerar Windows instalado/portátil e Linux .deb/AppImage com plugins Qt, QSQLITE, módulos QML, formatos de imagem e dependências necessárias. Validar em máquinas sem ambiente de desenvolvimento. A seleção de pacote não depende apenas do SO: guardar identidade do canal instalado/portátil.

Usar instalador NSIS Windows compatível com identidade, diretório e desinstalação existentes. Antes de publicar Qt como sucessor, uma release Electron de transição deve migrar localStorage, respeitar o lock e consumir uma ponte validada. Durante o corte, manter instalador Qt completo e metadados `latest.yml`/`.blockmap` gerados por tooling compatível com o electron-updater legado; não escrever esses metadados manualmente. Testar a atualização real de uma instalação Electron antes de permitir sua distribuição automática. Ferramentas Node de release podem permanecer no CI, sem entrar no runtime Qt.

O atualizador C++ usa manifesto nativo versionado e assinado, chave pública embutida, hash/tamanho do pacote e validação de destino HTTPS. Só executa instalador depois de validar assinatura e conteúdo; chave privada fica fora do repositório. Continuar atendendo feeds legados durante a janela de transição e separar os assets nativos de metadados Electron. Não implementar aplicação in-place antes de testes de download interrompido, pacote adulterado, instalação e recuperação. Linux e portátil mantêm atualização externa. Splash continua condicional, com limite de 30 segundos e possibilidade de continuar offline.

## Risks / Trade-offs

- [Diferenças entre spec, README e código] → inventário de paridade e decisões explícitas antes de cada módulo; não perpetuar divergências por cópia automática.
- [Fidelidade de blur/fontes e drivers] → protótipo e matriz de capturas nos dois SOs antes de reconstruir todas as telas.
- [Corrupção ou biblioteca duplicada por caminho diferente] → resolução compatível, lock comum, fixtures legadas e snapshot consistente.
- [Regressão em ZIP64 e grandes coleções] → fixtures grandes geradas, limites de recursos, falhas simuladas e comparação com Electron.
- [Mais código de gerenciamento de recursos em C++] → RAII, ownership explícito, smart pointers onde necessário, sanitizers no CI compatível e revisão das fronteiras de threads.
- [Custo de updater e distribuição] → ponte testada e release nativa bloqueada até comprovar transição; fallback manual documentado em falhas.
- [Licenças de módulos e assets] → inventário de dependências/avisos e verificação da configuração efetivamente distribuída.

## Migration Plan

1. Congelar referência de comportamento/design, registrar divergências e medir baseline Electron com fixtures.
2. Criar runtime Qt isolado em `native/`, protótipo visual e smoke Windows/Linux usando cópias.
3. Portar persistência e serviços; validar dados, backups e migrations antes de usar o perfil real.
4. Completar todas as telas e integrações, comparando a matriz por funcionalidade.
5. Preparar ponte Electron, updater Qt, instaladores e testes de atualização em ambientes descartáveis.
6. Executar regressão, comparação visual e benchmark; publicar artefatos somente após todos os critérios de corte.
7. Atualizar README, regras do projeto, purposes das specs que ainda descrevem Electron e comandos oficiais. Remover runtime antigo após o corte, mantendo material de rollback e fixtures de compatibilidade.

Rollback antes do corte mantém Electron como distribuição principal. Após o corte, preservar schema compatível sempre que possível; restauração de snapshot incompatível é explícita e nunca automática sobre dados mais novos. Falha do instalador/updater deve conservar a instalação anterior e seus dados.

