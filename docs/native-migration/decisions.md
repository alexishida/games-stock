<!-- Registro das divergências encontradas antes de reconstruir a interface. -->
# Referência de comportamento da migração

O pedido do usuário é manter o design. O comportamento efetivo do app é a referência para layout e fluxos existentes; o DESIGN.md fornece os tokens e princípios. Divergências não autorizam redesenho implícito. A matriz de paridade está congelada em `parity.md`; o gerador histórico foi movido para `tools/legacy-runtime/scripts/`.

| Assunto | Evidência existente | Decisão e como verificar |
|---|---|---|
| Janela inicial | `src/main/index.ts`: 1122x957; spec app-shell: 1225x818 | Adotar 1122x957 e mínimo 1024x768; ler window-bounds.json anterior e ajustar monitores. Testar perfil novo e geometria legada. |
| Largura da sidebar | DESIGN.md: 280px; Sidebar.css: 240px | Preservar 240 pixels lógicos do app atual. Capturas com limite de diferença de 2 pixels lógicos. |
| Tipografia | DESIGN.md: Inter; global.css: Segoe UI/system-ui/Arial; não há @font-face Inter no renderer | Preservar a família realmente renderizada por SO na referência inicial. Não trocar silenciosamente para Inter. Registrar família resolvida nas capturas; embutir Inter só após uma decisão visual explícita. Atualizar os artefatos de design para refletir este achado. |
| Busca e TopBar | TopBar.css: barra de 52px, campo de 34px, largura máxima 480px, blur 14px | Manter estas medidas e estados, incluindo ícones e contador. |
| Grade de jogos | GameGrid.css: colunas 212px, breakpoints 188px/148px | Portar breakpoints e espaçamentos reais; não usar grid genérico com outra densidade. |
| Configurações | NAV_ITEMS/SettingsSection incluem logs; library-ui lista somente sete seções | Conservar as oito seções: plataformas, emuladores, biblioteca, covers, partidas, backup, logs e sobre. Preservar os rótulos efetivos, inclusive Mídia da biblioteca. |
| Cor de fundo | DESIGN.md descreve #121212 e também declara #131313; global.css usa #131313 | Adotar #131313 e as variáveis efetivas de global.css; não aproximar cores por tema padrão do Qt. |
| Ícones | Regra exige lucide-react; UI QML não usa React | Manter desenhos Lucide em SVG local, com licença ISC. Exceção restrita à migração Qt, sem alterar a regra do renderer existente. |
| Categorias de backup | Comentários e README mencionam quatro; tipos e spec incluem inventoryImages | Preservar cinco categorias e seus payloads, incluindo fotos e metadados do inventário. Testar preview/export/import de cada categoria. |
| Compactação de backup | RULES.md antigo pede adm-zip; dataPortability.ts implementa ZIP64 próprio | O formato e a compatibilidade de arquivos prevalecem. A implementação C++ deve suportar STORED/DEFLATED/ZIP64, incluindo arquivos grandes; não reduzir a capacidade para simplificar a porta. |
| Metadados | Spec descreve LaunchBox; fontes reais incluem OpenVGDB e Libretro | Portar as três fontes e os fallbacks; usar respostas locais nos testes para não depender da disponibilidade da rede. |
| API da biblioteca | Spec de CRUD omite sidebarCounts; preload também contém operações em lote para emuladores e syncConfiguredFolders | Inventário AST é a referência completa de operações. Preservar equivalentes em C++, mesmo quando ausentes na lista abreviada da spec. |
| Inventário multiplataforma | HardwareItemDao tem is_multiplatform e rótulo Multiplataforma | Preservar flag e vínculos; não criar plataforma fictícia na biblioteca. |
| Progresso de portabilidade | Spec ainda menciona IPC/renderer | Usar modelo observável nativo; o contrato é progresso visível e persistência por transição, sem IPC Electron. |
| Estado legado | Pastas e jobs usam app_state; pode existir localStorage de versões antigas | Ponte Electron migra os dados antes do corte. Qt não interpreta diretamente LevelDB do Chromium. |
| Tecnologia declarada | README cita Electron 41 em tabela; package.json declara ^43.3.0 | Registrar runtime efetivo no relatório de execução; não usar a tabela antiga como versão da medição. |
| Runtime de benchmark | Módulos better-sqlite3/sharp são compilados para Electron | Rodar fixtures de referência com o Electron instalado no projeto em modo Node. Não recompilar o módulo para o Node do terminal. |
| Telas sem gatilho na UI | `ManualGameModal` e `LaunchBoxImporter` só têm listeners IPC sem emissor; o menu nativo foi removido | Reconstruir os fluxos em QML (tarefas 5.2 e 7.6) e registrar a captura Electron indisponível como lacuna documentada, nunca como remoção de tela. |
| Confirmação de exclusão de jogo | `window.confirm` nativo do Chromium | Preservar confirmação bloqueante equivalente no Qt; a comparação visual fica limitada ao diálogo do sistema operacional. |

Nenhuma divergência acima permite descartar dados, mudar o formato de backup, retirar telas ou declarar ganho de performance sem medição. O Electron continua como distribuição principal até passar a matriz de paridade, a transição e os pacotes nativos.

