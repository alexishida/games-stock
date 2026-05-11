# GameStock — Guia para IA

## Stack

- Electron + Vite + React + TypeScript
- SQLite via better-sqlite3
- Zustand para estado global no renderer
- IPC via `contextBridge` (preload exposto em `window.gameStockAPI`)

## Convenções de UI

### Design
Sempre que for criar alguma funcionalidade, tela, modal, botão, campos de formulários ou qualquer coisa que use CSS, seguir `.ai-framework/DESIGN.md`.

### Icones
Usar sempre `lucide-react` para ícones da UI. A dependência deve ficar local no projeto, importando apenas os ícones necessários em cada componente. Não usar Material Symbols, fontes remotas de ícones ou SVG inline quando existir equivalente Lucide.

### Janelas e modais

**Nunca criar uma `BrowserWindow` separada do Electron para fluxos de UI.**

Quando o usuário pedir "abrir uma nova janela", "abrir em uma janela", ou qualquer variante, a implementação correta é sempre um **modal/overlay dentro do renderer React**, seguindo o padrão já usado no projeto:

- Overlay: `position: absolute; inset: 0` dentro de um container `position: relative`
- Dialog flutuante por cima: div com `border`, `border-radius`, `background: var(--bg-panel)`, `box-shadow`
- Todo modal React do projeto deve ser **arrastável por padrão**, inclusive modal principal, modal de formulário, modal de confirmação e modal secundário sobreposto, salvo exceção explícita de UX muito bem justificada
- Reutilizar lógica compartilhada de drag (ex.: hook utilitário no renderer) em vez de reimplementar comportamento diferente em cada modal
- Ver `.panel-confirm-overlay` + `.confirm-dialog` em `RomFolderImporter.css` como referência

`BrowserWindow` adicional só é justificado para funcionalidade completamente independente da janela principal (ex.: janela de configurações do sistema operacional). Fluxos de cadastro, formulários, confirmações e assistentes sempre usam modal React.

### Padrão de overlay no projeto

```tsx
// No container pai: position: relative
<div className="rom-folder-panel"> {/* position: relative */}
  {overlayOpen && (
    <div className="panel-confirm-overlay"> {/* position: absolute; inset: 0 */}
      <div className="confirm-dialog"> {/* o card flutuante */}
        ...
      </div>
    </div>
  )}
</div>
```

## Arquitetura IPC

- Canais definidos em `src/shared/ipc-channels.ts`
- Handlers registrados em `src/main/index.ts` via `ipcMain.handle`
- Expostos ao renderer em `src/preload/index.ts` via `contextBridge`
- Tipos em `src/preload/types.d.ts`

Sempre que adicionar um canal IPC, atualizar os 4 arquivos acima.

## Arquitetura SQLite

- Todo código relacionado ao SQLite deve ficar em `src/main/db`.
- Conexão, schema, migrations simples e seeds ficam em `src/main/db/database.ts`.
- Chamadas SQL (`prepare`, `transaction`, queries e comandos) devem ficar nos DAOs em `src/main/db/dao`.
- Repositórios em `src/main/db/repositories` devem ser fachadas finas ou orquestração; não colocar SQL direto neles.
- Código fora de `src/main/db` deve acessar o banco via repositórios/DAOs exportados, nunca via `better-sqlite3` direto.

## Arquitetura de portabilidade de dados

- Fluxos de exportação e importação de dados devem rodar no `main process`, nunca no renderer.
- UI de portabilidade deve viver dentro de `Configurações`, em modal React já existente. Não criar `BrowserWindow` nova para exportar, importar, revisar ou confirmar restore.
- Seleção de arquivo/pasta deve usar diálogos nativos via IPC.
- Pacote de backup deve usar formato zip com extensão sugerida `.gamestock-backup`.
- Implementação deve reutilizar `adm-zip`, sem adicionar dependência nova para empacotamento do backup.
- Categorias suportadas devem continuar independentes: `metadata`, `images`, `platforms` e `romLocations`.
- Importação com escrita em SQLite deve ser transacional. Se falhar, reverter banco e reportar resumo claro do erro.
- Caminhos de imagens importadas devem ser regravados para diretório de dados atual do app; nunca preservar path absoluto de outra máquina.
- ROMs físicas não entram no backup. Exportar e importar apenas caminhos de ROM e entradas configuradas de pastas.
- Entradas do importador de pastas de ROM, histórico de jobs e demais estados persistidos da UI devem ficar no SQLite local, via `src/main/db`, sem depender de `localStorage` do renderer.
- Matching de importação não deve depender de IDs SQLite brutos do pacote. Preferir chaves estáveis:
  - Plataformas por `name` case-insensitive.
  - Jogos por `launchbox_id + platformName`; fallback `title + platformName`.
  - Emuladores por `name`.

## Regra aprendida: estado assíncrono compartilhado

Sempre usar Zustand (`src/renderer/store/index.ts`) para qualquer estado assíncrono que precise ser visível em mais de um componente (ex: download em andamento, job de importação, flags de loading global).

Nunca usar `window.dispatchEvent` como mecanismo de estado compartilhado. Eventos são fire-and-forget — componentes que montam depois do evento já ter sido emitido perdem o estado. O Zustand persiste o valor e qualquer componente lê o estado atual ao montar.

## Regra aprendida: modais empilhados

Quando já existir um modal aberto e outro modal/confirmação for aberto acima dele, o modal de trás deve receber nova camada escura semi-transparente. Isso vale para 2º, 3º, 4º modal e seguintes, para manter o modal de cima mais legível.

Exemplo atual: `.panel-confirm-overlay` em `RomFolderImporter.css` deve usar `background: rgba(...)` quando usado dentro do modal de configurações. O modal filho continua com `border`, `border-radius`, `background: var(--bg-panel)` e `box-shadow`.

## Regra aprendida: todos modais arrastaveis

Todo modal React do projeto deve ser arrastável dentro da área da janela principal. Isso inclui modal principal, modal secundário, confirmação, assistente, formulário e modal aberto sobre outro modal. Use overlay React, não `BrowserWindow`.

- O drag deve funcionar pelo corpo do modal sempre que possível.
- Controles interativos (`button`, `input`, `select`, `textarea`, `label`, links e elementos com `role="button"`) não devem iniciar drag, para manter clique, foco e seleção funcionando.
- O modal deve iniciar centralizado e ter deslocamento limitado para não sair da área visível da janela.
- Para mover modal arrastável, preferir `position: relative/fixed` com `top/left` ou variáveis equivalentes. Evitar `transform: translate(...)` no container do modal quando ele puder abrir outro modal por cima, porque isso prende overlays `position: fixed` filhos ao retângulo do modal pai.
- Quando o modal precisar cobrir toda a área arrastável, usar overlay `position: fixed; inset: 0`; para modal empilhado, permitir fundo transparente quando isso fizer mais sentido visual.
- Em implementação nova, preferir reutilizar hook/utilitário compartilhado de drag em vez de duplicar lógica inline.
- Só abrir exceção para modal não arrastável quando houver motivo claro de UX e isso for descrito explicitamente na tarefa.
- Botões de ação no rodapé de modal devem ficar alinhados à direita (`justify-content: flex-end`) com gap consistente.
