<!-- Registro da correção de abertura e da recuperação da splash original do Electron. -->
# Inicialização e splash

A abertura cria as abas de Configurações somente quando o modal é aberto pela
primeira vez. O Loader mantém os objetos após fechar, preservando formulários e
estado entre aberturas. Abas ocultas não leem logs, estatísticas de mídia ou o
tamanho do perfil em Component.onCompleted.

A criação de tabelas, índices e colunas ocorre em uma transação. O commit termina
antes das migrations de dados, que mantêm suas próprias transações e snapshots.
Nenhum ID, preferência ou dado do usuário precisa ser recriado ou reimportado.

StartupSplash usa a arte WebP original do Electron (blob
`2b71b9a4e1e8d91af3ac45744b2d5cdd6a88524e`), janela 640×400, versão/build no
topo direito e status no rodapé. A splash é ocultada no primeiro quadro da
principal, sem duração mínima artificial.

## Medição local

Windows, Qt 6.8.3, MSVC Release. Perfil sintético com 5.000 jogos manuais e 2.000
arquivos de mídia fictícios. Três execuções consecutivas após aquecimento, no
mesmo perfil. O executável anterior foi preservado para comparação.

| Execução | Antes (ms) | Depois (ms) |
| --- | ---: | ---: |
| 1 | 1745,2 | 1295,4 |
| 2 | 1685,4 | 1289,5 |
| 3 | 1717,1 | 1248,5 |
| Mediana | 1717,1 | 1289,5 |

Redução local de aproximadamente 25%. A medição usa `--startup-report`, que
mede até o primeiro quadro da principal e desativa a janela transitória em ambas
as versões. Não representa medição da versão Electron, abertura fria do sistema,
consulta ao feed ou do perfil real. Os relatórios novos também contêm os marcos
de banco, serviços e criação do QML para localizar futuras regressões.

Artefatos: `artifacts/native-migration/startup-fix/`, incluindo relatórios
`before-*.json`, `final-*.json`, `splash.png` e capturas das configurações antes/depois.

## Validação

- Build Release do executável atualizado.
- CTest: suites `migrations` e `settings-service` aprovadas, incluindo banco limpo
  e compatibilidade com dados legados.
- 58 testes QML aprovados. Regressões verificam ausência de leituras de abas
  ocultas e criação/reutilização das configurações somente após sua abertura.
- Splash capturada e inspecionada; configurações comparadas visualmente antes/depois.
- Todos os testes usam perfis sintéticos, sem acesso ao perfil real.
