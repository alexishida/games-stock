# GameStock — Guia para IA

## Stack oficial

- **C++20 + Qt 6.8.3 Quick/QML**, build CMake em `native/`.
- SQLite via QSQLITE; DAOs em `native/src/db/dao`.
- Serviços `QObject` tipados e modelos `QAbstractListModel`; QML não contém SQL.
- libarchive + zlib vendorizados para ZIP/ZIP64 de backup.
- O runtime distribuído **não** depende de Electron, React, Node ou WebView.
- O projeto Electron/React e seu backend congelado foram removidos após verificação de paridade.
  A compatibilidade usa fixtures SQL e backups sintéticos em `native/tests/fixtures/`.
  O build/testes/deploy não dependem de Node/npm. Python stdlib serve apenas às fixtures.


## Convenções de UI

### Design
Seguir `.ai-framework/DESIGN.md` e os tokens de `native/qml/Theme.qml`. Não redesenhar a identidade,
tipografia, espaçamentos ou efeitos durante correções comuns.

### Ícones
Usar os SVGs Lucide locais em `native/assets/` via `ActionButton`/`NavigationButton`/`Image`. Não
introduzir família visual diferente, fonte remota ou dependência React no runtime.

### Topo padrão de coleções
Biblioteca e inventário usam o mesmo padrão:

- busca à esquerda (34 px, máximo visual 480 px, placeholder específico);
- ordenação, alternância cards/lista e contador `Exibindo X de Y`;
- preferências independentes entre biblioteca e inventário;
- detalhe aberto pode manter apenas a busca.

### Janelas e modais

- Fluxos de UI são overlays dentro da janela principal (`DragDialog`/QML). A única exceção é a
  splash transitória de bootstrap, anterior ao banco/serviços e ocultada no primeiro quadro da principal.
- Todo modal é arrastável pelo corpo, limitado à área visível, centralizado ao abrir.
- Controles interativos não iniciam arraste.
- Modal empilhado escurece a camada inferior (`Theme.stackedScrim`).
- Ações do rodapé à direita; Cancelar antes da ação principal.

## Arquitetura nativa

- `native/src/app`: bootstrap, perfil, lock, janela, canal, caminhos e mídia.
- `native/src/services`: fachadas `QObject` por domínio; validação e orquestração.
- `native/src/db`: schema, migrations, seeds, conexões e DAOs. Toda SQL fica nos DAOs.
- `native/src/models`: papéis tipados para QML.
- `native/src/jobs`: `JobRegistry`, `JobManager` e `JobWorker`; progresso fora da thread gráfica.
- `native/src/portability` e `native/src/update`: ZIP/ZIP64, manifesto e updater assinado.
- `native/qml`: `Main.qml`, `Theme.qml` e componentes `qml/components`.

Não expor SQL, filesystem irrestrito, `QProcess` genérico ou objetos internos ao QML. Serviços
retornam DTOs/mapas estáveis; erros são mensagens acionáveis.

## Arquitetura SQLite

- Conexões pertencem à thread que as criou (`WriteConnection`/`ReadOnlyConnection`).
- Migrations/seed preservam IDs e dados existentes; nunca `DROP TABLE` como atalho.
- Foreign keys e timeout habilitados; operações de escrita em transação.
- Snapshot consistente antes de migration nova; schema futuro é recusado.
- QML nunca executa SQL nem abre conexões.

## Retrocompatibilidade com dados existentes

O banco do usuário é a fonte da verdade. Toda mudança deve funcionar em instalação limpa e em banco
populado por versões anteriores.

- Nunca assumir banco vazio ou exigir reimportação.
- Colunas novas precisam de default/backfill; renomeações exigem migration de dados.
- Dados sujos de versão anterior recebem saneamento em migration.
- Importadores/jobs devem ser idempotentes e não duplicar relacionamentos.
- Chaves de matching estáveis: plataforma por `name`; jogo por `launchbox_id + platformName` ou
  `title + platformName`; emulador por `name`; nunca IDs autoincrementais do pacote.
- Estado de UI persistido deve tolerar campos ausentes.

Pergunta obrigatória em feature/bugfix: “como isso se comporta no banco de um usuário que já usa o
app há meses?”. Se a resposta for reset/reimport, a abordagem está errada.

## Portabilidade e backups

- Formato `.gamestock-backup` schemaVersion 1 com ZIP/ZIP64 e manifesto assinado/validado.
- Cinco categorias independentes: `metadata`, `images`, `platforms`, `romLocations`,
  `inventoryImages`.
- Exportação/importação em `BackupService`, fora da thread gráfica; UI consome progresso do
  `JobManager`.
- Importação é transacional; mídias passam por staging, com rollback e preservação de arquivos
  preexistentes.
- Não embutir ROMs físicas; salvar caminhos e configurações de pastas.
- Caminhos de mídia importados são regravados para o perfil atual, nunca para a máquina de origem.

## Atualizações

- Feed `latest.json` assinado (ECDSA P-256/SHA-256) publicado manualmente em GitHub Releases.
- Chave privada fica fora do repositório; só a pública entra em `UpdateConfig.h`.
- Verificar assinatura, SHA-256 e tamanho antes de executar o instalador.
- Portátil/Linux usam atualização externa; nunca execução in-place.
- Não publicar releases automaticamente a partir de um agente.

## Regra: documentação obrigatória de código

Todo arquivo criado ou alterado deve ter comentários em **português (pt-br)**.

- Arquivo novo: bloco no topo com propósito + Doxygen `/** */` para classes/funções/tipos exportados.
- Arquivo alterado: comentar o que foi criado/modificado; não reescrever o que não foi tocado.
- Comentar o **porquê** em invariantes, workarounds e restrições; o quê fica nos nomes.
- Termos técnicos fixos (SQLite, DAO, job, worker, provider) permanecem em inglês.

## Estado assíncrono compartilhado

- `JobManager`/`JobRegistry` são a fonte única de jobs; não criar estado paralelo na tela.
- Progresso atualiza apenas memória/sinais; SQLite recebe início, conclusão, falha e dispensa.
- `running` vira `interrupted` na reabertura; retomada não pode duplicar entidades.

## Modais e empilhamento (QML)

- Reutilizar `DragDialog`/`ConfirmDialog`; não duplicar drag em cada tela.
- O fundo é desfocado na superfície principal (`blurDepth`), não no painel do modal.
- Overlay apenas escurece; escurecimento maior quando há modal empilhado.
- Modais devem caber na janela mínima (1024×768) e preservar foco/Escape.

## Testes

- CTest para DAOs/serviços/jobs/ZIP/updater; QML tests para telas e interações.
- Usar sempre perfis/DBs temporários e fixtures sintéticas; nunca o perfil real.
- Testes de migração/backup/updater não podem depender de rede externa nem de segredos do usuário.
- Alterações de UI devem manter a comparação visual contra `artifacts/native-migration`.
