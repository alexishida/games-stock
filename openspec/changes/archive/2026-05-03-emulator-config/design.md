## Context

GameStock gerencia uma biblioteca de jogos por plataforma mas não tem como lançá-los. Falta a camada de emuladores: qual executável rodar, com quais argumentos, e qual emulador usar quando uma plataforma tem mais de um disponível.

O projeto usa Electron + SQLite (better-sqlite3), com a arquitetura IPC já consolidada: canais em `ipc-channels.ts`, handlers em `main/index.ts`, exposição via `contextBridge` em `preload/index.ts`. O padrão de DAO + Repository thin-facade já existe em `src/main/db/dao/` e `src/main/db/repositories/`.

## Goals / Non-Goals

**Goals:**
- CRUD de emuladores (nome, caminho do executável, argumentos padrão)
- Associação N:M entre emuladores e plataformas, com emulador padrão por plataforma
- Lançamento de jogo: resolver emulador padrão da plataforma e executar processo filho
- UI de gerenciamento dentro do SettingsModal (nova seção "Emuladores")

**Non-Goals:**
- Auto-detecção de emuladores instalados no sistema
- Perfis de argumentos por jogo individual (só por emulador)
- Download ou atualização de emuladores
- Histórico de sessões de jogo

## Decisions

### D1: Esquema de dados — tabela `emulators` + tabela `platform_emulators`

```sql
CREATE TABLE emulators (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  executable   TEXT    NOT NULL,
  args         TEXT    NOT NULL DEFAULT '',
  is_retroarch INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE platform_emulators (
  platform_id  INTEGER NOT NULL REFERENCES platforms(id)  ON DELETE CASCADE,
  emulator_id  INTEGER NOT NULL REFERENCES emulators(id)  ON DELETE CASCADE,
  is_default   INTEGER NOT NULL DEFAULT 0,
  core_path    TEXT,           -- apenas para emuladores com is_retroarch = 1
  PRIMARY KEY (platform_id, emulator_id)
);
```

**Seed RetroArch**: ao criar as tabelas, inserir um registro padrão em `emulators` com `name = 'RetroArch'`, `executable = ''` (vazio até o usuário configurar) e `is_retroarch = 1`. O usuário configura o caminho do executável na UI.

**Alternativa considerada**: coluna `emulator_id` direto em `platforms`. Descartada porque limita a um emulador por plataforma e impede escolha no momento do lançamento.

**Alternativa considerada**: JSON blob em `platforms`. Descartada — dificulta queries e viola a arquitetura SQLite do projeto.

### D2: Garantia de no máximo um `is_default = 1` por plataforma via trigger

Um UNIQUE partial index não é suportado de forma confiável em todas as versões do SQLite embedded. Usar trigger `BEFORE INSERT/UPDATE` que zera `is_default` dos outros emuladores da mesma plataforma antes de setar o novo padrão. Simples e portável.

**Alternativa**: enforçar no DAO. Menos confiável (race condition se múltiplos writes simultâneos), e a lógica de consistência pertence ao banco.

### D3: Lançamento de processo via `child_process.spawn` no main process

O renderer solicita via IPC (`games:launch`). O main process resolve o emulador (plataforma do jogo → emulador padrão → executável + args) e bifurca:

- **Standalone**: `spawn(executable, [...parsedArgs, romPath])`
- **RetroArch** (`is_retroarch = 1`): `spawn(executable, ['-L', corePath, romPath])`; o campo `args` do emulador é ignorado (RetroArch não precisa de args extras por plataforma, o core já define o comportamento)

Retorna `{ success: true }` imediatamente; erros de processo são logados mas não bloqueiam a UI.

**Alternativa**: `exec` com string concatenada. Descartada — vulnerável a injeção de argumentos se nome do arquivo tiver espaços ou caracteres especiais. `spawn` com array é seguro.

### D6: RetroArch — core_path por associação, não por emulador

O `core_path` fica em `platform_emulators`, não em `emulators`. Um único registro RetroArch serve todas as plataformas; cada plataforma define seu próprio core. Isso evita criar um registro de emulador separado por plataforma/core.

**Alternativa**: emulador separado por core (ex: "RetroArch — Snes9x"). Descartada — fragmenta a lista de emuladores e duplica o caminho do executável.

**Alternativa**: campo `core_path` em `emulators`. Descartada — um RetroArch com core fixo não pode ser reusado em múltiplas plataformas com cores diferentes.

### D4: UI — nova seção "Emuladores" no SettingsModal, mesmo padrão do PlatformManager

Lista de emuladores com botão "Novo emulador" e ações inline de editar/excluir. Modal flutuante arrastável para criar/editar (mesmo padrão de `PlatformFormModal`). Associação plataforma↔emulador em sub-seção separada dentro do mesmo SettingsModal.

Ao vincular RetroArch a uma plataforma, o formulário de associação exibe campo adicional "Core" (caminho do `.dll`/`.so`). Para emuladores standalone, campo "Core" fica oculto.

**Alternativa**: Tab dedicada. Possível, mas a UI de settings já tem o padrão de seções verticais — manter consistência.

### D5: Parsing de argumentos — split simples por espaço, sem shell quoting

O campo `args` armazena argumentos separados por espaço (ex: `-fullscreen -noaudio`). Split por espaço no momento do lançamento. Argumentos com espaço devem ser evitados na config — documentar limitação.

**Alternativa**: suporte a quoting shell-style. Adiciona complexidade (precisaria de biblioteca de parsing) sem caso de uso claro nos emuladores comuns.

### D7: RetroArch protegido contra deleção em duas camadas

`EmulatorDao.delete()` rejeita com erro se `is_retroarch = 1`. A UI omite o botão de excluir para emuladores RetroArch. Dupla proteção: a UI evita o caso comum; o DAO garante a invariante mesmo se chamado via outros caminhos.

**Alternativa**: só proteger na UI. Insuficiente — deixa o backend vulnerável a chamadas diretas ou futuras.

### D8: Diálogos de arquivo separados por contexto

O campo "Executável" usa `dialogs:openExecutableFile` (filtra `.exe/.bat/.cmd/.sh` + "Todos os arquivos"). O campo "Core" usa `dialogs:openAnyFile` (sem filtro) porque cores RetroArch têm extensões variadas por plataforma (`.dll` no Windows, `.so` no Linux, sem extensão em alguns casos).

**Alternativa**: reusar `openRomFile` para ambos. Descartado — filtro de ROMs confunde o usuário ao buscar executáveis.

## Risks / Trade-offs

- **Caminho do executável inválido** → `spawn` vai falhar silenciosamente para o usuário. Mitigação: validar se o arquivo existe antes de spawnar e retornar erro IPC com mensagem clara.
- **Jogo sem ROM path** → não tem o que lançar. Mitigação: botão "Launch" desabilitado se `rom_path` for null/vazio.
- **Plataforma sem emulador padrão** → o lançamento falha. Mitigação: botão "Launch" desabilitado ou tooltip explicativo se a plataforma não tiver emulador padrão configurado.
- **Trigger SQLite** → pode ser removido por migrations futuras inadvertidamente. Mitigação: documentado no schema como invariante crítico.

## Migration Plan

1. `database.ts` — adicionar `CREATE TABLE IF NOT EXISTS` para `emulators` (com `is_retroarch`) e `platform_emulators` (com `core_path`) + trigger de exclusividade de `is_default` + seed do RetroArch
2. Nenhum dado existente é afetado; rollback = remover as novas tabelas (sem perda)
3. Deploy: rebuild Electron app — migration roda automaticamente na inicialização do banco
