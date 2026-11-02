<!-- Contrato de perfil, lock, migrations e recuperação (tarefas 4.6 e 4.7). -->
# Perfil, lock e recuperação

Este documento fixa onde o runtime nativo lê e escreve, como Electron e Qt evitam abrir o mesmo
perfil ao mesmo tempo e qual é o procedimento de retorno quando uma migration falha. Nada aqui
autoriza apagar dados do usuário: o retorno sempre parte de um snapshot explícito.

## Diretórios

| Item | Caminho |
|---|---|
| Override | `GAMESTOCK_USER_DATA_DIR` (tem prioridade sobre tudo) |
| Windows | `%APPDATA%/gamestock` |
| Linux | `$XDG_DATA_HOME/gamestock` ou `~/.local/share/gamestock` |
| Banco | `<perfil>/gamestock.db` (WAL pode gerar `gamestock.db-wal`/`-shm`) |
| Capas e mídias | `<perfil>/images/...` |
| Fotos do inventário | `<perfil>/inventario/images/...` |
| Snapshots | `<perfil>/backups/pre-migration-<UTC>.db` |
| Geometria da janela | `<perfil>/window-bounds.json` |
| Lock | `<perfil>/gamestock.lock` |
| Log do protótipo | `<perfil>/native-prototype.log` |

O caminho é resolvido por `DataPaths` (nunca por `QStandardPaths`), porque o usuário pode ter o
aplicativo instalado em modo portátil e apontado por override.

## Contrato de lock

O arquivo `gamestock.lock` é JSON compacto, criado com `QIODevice::NewOnly` (O_EXCL, atômico):

```json
{"runtime":"qt","pid":12345,"startedAt":"2026-11-01T20:00:00Z","token":"<uuid>"}
```

- `runtime`: `qt` ou `electron`; o erro de conflito mostra o valor encontrado.
- `pid`: processo detentor. O lock só é considerado obsoleto quando esse PID não existe mais.
  O lock **não** expira por idade, para não derrubar um runtime lento ou pausado.
- `startedAt`/`refreshedAt`: diagnóstico. `refresh()` regrava o arquivo com `QSaveFile` sem trocar
  o token, para que leitores nunca vejam JSON parcial.
- `token`: identifica a instância. `release()` só remove o arquivo quando o token confere, então um
  release atrasado não apaga um lock retomado por outro processo.
- Lock ilegível (processo caiu durante a escrita) é descartado e recriado.

O lado Electron precisa executar o mesmo protocolo antes de tocar no perfil. Essa ponte é a tarefa
10.4; até ela existir, a detecção de um Electron antigo depende de o Electron respeitar o arquivo —
por isso o corte continua bloqueado.

`ProfileLock::processAlive` usa `OpenProcess`/`GetExitCodeProcess` no Windows e `kill(pid, 0)` no
Linux/macOS. Reutilização de PID é aceitável: o processo vivo apenas mantém o lock.

No protótipo, `main.cpp` adquire o lock (`runtime = "qt"`) antes de abrir qualquer banco e o libera
no encerramento; um segundo processo recebe erro e código 8.

## Política de migration

1. O arquivo é inspecionado por uma conexão curta de leitura.
2. `schema_migrations` com nome desconhecido → recusa explícita, sem escrita (versão futura).
3. Migrations conhecidas pendentes → snapshot `VACUUM INTO` em `backups/` antes de qualquer escrita.
   Falha do snapshot aborta a abertura.
4. Schema, migrations e seeds seguem a ordem do Electron; cada migration registra o nome na mesma
   transação.
5. `running` de jobs vira `interrupted` somente em memória; o banco não é reescrito no boot.

## Procedimento de retorno

Executar com o aplicativo fechado, em uma cópia do perfil quando possível:

1. Identificar o snapshot anterior em `<perfil>/backups/` (o mais recente anterior ao problema).
2. Mover `gamestock.db`, `gamestock.db-wal` e `gamestock.db-shm` para um diretório de descarte —
   não apagar, para permitir análise.
3. Copiar o snapshot escolhido para `<perfil>/gamestock.db`.
4. Abrir novamente. As migrations são reaplicadas ao snapshot; o schema volta ao estado compatível.
5. Registrar que dados criados depois do snapshot **não** estarão no banco restaurado. O retorno é
   sempre explícito; o aplicativo nunca restaura sozinho nem sobrescreve dados novos.

O teste `SnapshotTest::restoreProcedure` executa exatamente esses passos em um diretório temporário:
cria banco legado, abre (ganha snapshot), grava um dado novo, substitui o banco pelo snapshot,
reabre e confirma que o dado novo desapareceu, o dado original permanece e a migration é reaplicada.

## Evidência

```powershell
$env:PATH = "$PWD/.native-tools/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
native/build/windows-msvc/Release/profile_lock_tests.exe -o "$env:TEMP\lock.txt,txt"
native/build/windows-msvc/Release/snapshot_tests.exe -o "$env:TEMP\snap.txt,txt"
```

`profile-lock` cobre aquisição exclusiva, segundo processo recusado com o detentor no erro, lock
obsoleto de PID morto, JSON parcial, Electron vivo recusado, `refresh` com token estável e
`release` que não apaga lock retomado. `snapshot` cobre rollback de migration, recusa de schema
futuro, falha de backup bloqueando escrita, snapshot anterior às migrations, snapshot com WAL
pendente e o procedimento de retorno completo.
