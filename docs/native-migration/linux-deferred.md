<!-- Registro do adiamento da etapa Linux, decidido com o usuário em 01/11/2026. -->
# Implementação Linux adiada

Por decisão do usuário em 01/11/2026, a implementação e a verificação no Linux ficam para depois.
O trabalho continua no Windows, e as tarefas do OpenSpec são marcadas apenas quando o escopo
Windows correspondente está comprovado. Nada nesta página autoriza declarar paridade Linux ou
distribuir pacotes `.deb`/AppImage.

## O que continua pendente do lado Linux

| Tarefa | Pendência Linux |
|---|---|
| 2.2 | `cmake --preset linux-gcc`, build com GCC/Clang e `ctest` no baseline Ubuntu 22.04. |
| 4.1 | Resolução `XDG_DATA_HOME`/`~/.local/share` no sistema real e recusa de symlink externo via `/proc/self/fd` (o código existe, mas só foi compilado no Windows). |
| 6.4 | Smoke de execução do emulador falso e dependências de extração (7-Zip) no Linux. |
| 9.x | Não há dependência de SO na portabilidade, mas a matriz Electron↔Qt precisa ser repetida em Linux antes de afirmar compatibilidade. |
| 10.1 | Build Linux com as dependências Qt (QSQLITE, módulos QML, formatos de imagem). |
| 10.3 | Atualização externa do pacote Linux/portátil (o updater nativo é só Windows). |
| 10.7 | Geração e teste de instalação de `.deb`/AppImage em ambiente limpo. |
| 11.1–11.3 | Matriz funcional, comparação visual, benchmarks e sanitizers no Linux. |
| 11.4 | Seção Linux do README e diagnóstico gráfico validado no sistema alvo. |
| 11.5 | Retirada do runtime legado: o corte exige as duas plataformas verificadas. |

## Pré-requisitos para retomar

- Qt 6.8.3 em `QT_ROOT` com os mesmos módulos fixados em
  [dependências](dependencies.md) e baseline documentado em [README nativo](../../native/README.md).
- Fixtures geradas por `node scripts/native-fixtures.cjs` em uma cópia do perfil, nunca o perfil real.
- Monitor com espaço para as resoluções da matriz, para não repetir o limite de tela registrado em
  [matriz visual](visual-matrix.md).

## Efeito nas demais tarefas

Tudo o que é independente de SO (serviços, DAOs, ZIP64, importadores, UI, testes unitários) continua
avançando no Windows. Tarefas marcadas como concluídas no OpenSpec valem para o escopo Windows e
devem ser reabertas se a compilação/teste Linux revelar regressão. A remoção do runtime legado e a
publicação ficam bloqueadas até a retomada.
