<!-- Persistência nativa: caminhos, schema, migrations, snapshot e concorrência. -->
# Banco e migrations

## Caminhos e abertura

`DataPaths` resolve exatamente o perfil legado:

1. `GAMESTOCK_USER_DATA_DIR`, quando definido;
2. `%APPDATA%/gamestock` no Windows;
3. `$XDG_DATA_HOME/gamestock` ou `~/.local/share/gamestock` no Linux.

O banco é `<perfil>/gamestock.db`; imagens ficam em `<perfil>/images` e o estado de janela em
`window-bounds.json`. `--profile-dir` permite um perfil explícito e `--fixture-db` só é aceito junto
dele, para nunca abrir o perfil real em testes.

Cada conexão SQL pertence à thread que a utiliza (`WriteConnection`/`ReadConnection`). O bootstrap
aplica schema e migrations idempotentes antes de iniciar os serviços. `foreign_keys` e timeout de
concorrência são habilitados por conexão.

## Schema e migrations

`native/src/db/Migrations.cpp` porta o schema e os seeds do Electron com os mesmos identificadores:
plataformas, aliases, extensões, jogos, emuladores, vínculos, `app_state`, inventário e
`schema_migrations`. Migrations conhecidas incluem `hardware-conservation-states-v1` e
`teknoparrot-profile-filename-v1`.

Antes de qualquer migration nova, `Snapshot` cria um snapshot consistente via mecanismo SQLite
(inclusive bancos em WAL). Falha de snapshot bloqueia a escrita e informa erro; não se cria uma
biblioteca vazia alternativa. Banco com schema futuro é recusado sem modificação. Reabrir um banco
já migrado é idempotente e preserva IDs e relacionamentos.

## DAOs e consultas

- Toda a SQL fica em `native/src/db/dao`; QML não executa consultas.
- Repositórios/serviços são fachadas finas de orquestração, sem SQL direto.
- A função/filtro de gênero foi portada sem carregar a biblioteca inteira; filtros usam parâmetros.
- Paginação, contagens, agrupamento de variantes e ordenação preservam o comportamento do Electron.
- `app_state` tolera JSON legado com campos ausentes; `running` vira `interrupted` na restauração.

## Lock de perfil

`ProfileLock` impede acesso concorrente entre Qt e a instância Electron de transição. O lock é
adquirido antes de qualquer escrita e liberado no encerramento. A ponte Electron de transição também
respeita o mesmo contrato; transações SQL não substituem o lock de processo.

## Recuperação

- Retorno de versão só é garantido com schema compatível.
- Restaurar snapshot incompatível é uma ação explícita, nunca automática sobre dados mais novos.
- O procedimento de retorno deve ser executado em cópia do perfil e está descrito em
  [profile.md](profile.md) e [backup.md](backup.md).

## Evidências

- `snapshot` cobre WAL, falha de backup, rollback transacional e schema futuro.
- `migrations` cobre banco limpo, schema antigo, reabertura idempotente e preservação de IDs.
- `profile-lock` cobre bloqueio concorrente e liberação.
- `game-read-dao`/`game-write-dao` cobrem paginação, contagens, filtros e escrita.

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir native/build/windows-msvc -C Release -R "migrations|snapshot|profile-lock|game-read-dao|game-write-dao" --output-on-failure
```
