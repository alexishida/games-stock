<!-- Comparação de release Electron/Qt na mesma máquina e massa (tarefa 11.2). -->
# Benchmark release Electron x Qt

Data: 02/11/2026 · Windows 11 · AMD Ryzen 7 5800X · 32 GiB · Qt 6.8.3 · Electron 43.3.0

Todas as medições usam cópias sintéticas da fixture `fixtures-H6UzzV`; nenhum perfil real é aberto.
Os números são de uma única máquina e **não autorizam afirmar ganho geral** de memória ou velocidade.

## Paginação (2.502 grupos, 5.000 jogos)

| Consulta | Electron | Qt |
|---|---:|---:|
| Página 1 | 9,6 ms | 15,7 ms |
| Página 2 | 9,5 ms | 15,3 ms |
| Página 10 | 9,4 ms | 14,5 ms |
| Busca + favoritos | 4,2 ms | 6,0 ms |
| Ordenação por mais jogados | 9,6 ms | 15,0 ms |
| Gênero `AÇÃO` + favoritos | 24,6 ms | 12,7 ms |
| Gênero `ς` | 58,3 ms | 6,0 ms |
| Gênero `İ` | 60,0 ms | 7,0 ms |

Electron inclui IPC/renderer no tempo; Qt mede a chamada direta ao `GameService` no processo nativo.
As consultas de gênero com sigma grego e I pontuado são as mais caras no Electron e baratas no Qt.

```powershell
native\build\windows-msvc\Release\native_benchmark.exe artifacts\native-migration\qt-benchmark\gamestock.db
```

## Inicialização e memória (janela principal)

Medição externa: tempo até `MainWindowHandle` e soma de `WorkingSet64` após 5 s de janela aberta.

| Runtime | Inicialização | Memória residente | Processos |
|---|---:|---:|---:|
| Electron | 6,2–6,8 s | 419 MB | 4 |
| Qt | 1,7 s | 255–260 MB | 1 |

O relatório interno do Qt (`--startup-report`) mede o primeiro quadro: **1,43–1,46 s** e
**271 MB** em três execuções. O `rendererFoundMs` do Electron (258 ms) mede apenas a
disponibilidade do DevTools, não o primeiro quadro, e não é comparável.

```powershell
native\build\windows-msvc\Release\gamestock_native.exe --profile-dir <perfil> `
  --fixture-db <perfil>\gamestock.db --startup-report <saida>.json
```

## Importação de 1.200 ROMs

Pasta sintética com 1.200 arquivos `.nes`, detecção automática, mesma massa nos dois runtimes:

| Runtime | Tempo | Registros |
|---|---:|---:|
| Electron | 7.640 ms | 1.200 |
| Qt | 5.179 ms | 1.200 |

```powershell
node tools\legacy-runtime\scripts\native-electron-import-benchmark.cjs
native\build\windows-msvc\Release\native_benchmark.exe --import 1200
```

O Electron usa o banco da fixture com `Metadata.xml` mínimo local; o Qt cria banco temporário pelas
mesmas migrations. Ambos caem no mesmo caminho de placeholders, mas a diferença de preparação do
banco impede tratar os tempos como benchmark micro-otimizado. O script Electron é histórico e exige
o backend congelado e as dependências de tooling.

## Leitura dos resultados

- A memória do Qt é de um processo único; a do Electron soma main, renderers e GPU.
- A inicialização externa mede a criação da janela, não o primeiro quadro; o Qt também reporta o
  primeiro quadro separadamente.
- Os tempos de paginação medem camadas diferentes (IPC/renderer versus serviço nativo).
- Não há conclusão de ganho por componente; apenas os valores medidos ficam registrados para a
  revisão de corte.
