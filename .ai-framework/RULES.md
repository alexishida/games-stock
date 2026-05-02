# GameStock — Guia para IA

## Stack

- Electron + Vite + React + TypeScript
- SQLite via better-sqlite3
- Zustand para estado global no renderer
- IPC via `contextBridge` (preload exposto em `window.gameStockAPI`)

## Convenções de UI

### Design
Sempre que for criar um form seguir o \DESIGN.md

### Icones
Usar sempre `lucide-react` para icones da UI. A dependencia deve ficar local no projeto, importando apenas os icones necessarios em cada componente. Nao usar Material Symbols, fontes remotas de icones ou SVG inline quando existir equivalente Lucide.

### Janelas e modais

**Nunca criar uma `BrowserWindow` separada do Electron para fluxos de UI.**

Quando o usuário pedir "abrir uma nova janela", "abrir em uma janela", ou qualquer variante, a implementação correta é sempre um **modal/overlay dentro do renderer React**, seguindo o padrão já usado no projeto:

- Overlay: `position: absolute; inset: 0` dentro de um container `position: relative`
- Dialog flutuante por cima: div com `border`, `border-radius`, `background: var(--bg-panel)`, `box-shadow`
- Ver `.panel-confirm-overlay` + `.confirm-dialog` em `RomFolderImporter.css` como referência

`BrowserWindow` adicional só é justificado para funcionalidade completamente independente da janela principal (ex.: uma janela de settings do sistema operacional). Fluxos de cadastro, formulários, confirmações e assistentes sempre usam modal React.

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

- Todo codigo relacionado ao SQLite deve ficar em `src/main/db`.
- Conexao, schema, migrations simples e seeds ficam em `src/main/db/database.ts`.
- Chamadas SQL (`prepare`, `transaction`, queries e comandos) devem ficar nos DAOs em `src/main/db/dao`.
- Repositorios em `src/main/db/repositories` devem ser fachadas finas ou orquestracao; nao colocar SQL direto neles.
- Codigo fora de `src/main/db` deve acessar o banco via repositorios/DAOs exportados, nunca via `better-sqlite3` direto.

## Regra aprendida: modais empilhados

Quando ja existir um modal aberto e outro modal/confirmacao for aberto dentro dele, nao criar nova camada escura de fundo. Manter o overlay interno apenas para posicionamento e bloqueio de clique, com `background: transparent`.

Exemplo atual: `.panel-confirm-overlay` em `RomFolderImporter.css` deve ficar transparente quando usado dentro do modal de configuracoes. O modal filho continua com `border`, `border-radius`, `background: var(--bg-panel)` e `box-shadow`.

## Regra aprendida: modais secundarios arrastaveis

Todo modal secundario aberto sobre outro modal deve ser arrastavel dentro da area da janela principal. Use overlay React, nao `BrowserWindow`.

- O drag deve funcionar pelo corpo do modal sempre que possivel.
- Controles interativos (`button`, `input`, `select`, `textarea`, `label`, links e elementos com `role="button"`) nao devem iniciar drag, para manter clique, foco e selecao funcionando.
- O modal deve iniciar centralizado e ter deslocamento limitado para nao sair da area visivel da janela.
- Quando o modal secundario precisar cobrir toda a area arrastavel, use overlay `position: fixed; inset: 0; background: transparent`.
- Botoes de acao no rodape de modal secundario devem ficar alinhados a direita (`justify-content: flex-end`) com gap consistente.
