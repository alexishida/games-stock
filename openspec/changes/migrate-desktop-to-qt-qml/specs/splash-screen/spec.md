<!-- Atualiza contratos afetados pela substituição do runtime, preservando os demais cenários. -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Exibicao de build e fases do updater

A splash SHALL mostrar versao e build instaladas, alem da fase atual recebida pelo serviço de atualização.

#### Scenario: Fase de checking

- **WHEN** o updater inicia a verificacao remota
- **THEN** a splash mostra mensagem equivalente a "Verificando atualizacoes..."

#### Scenario: Fase de downloading

- **WHEN** o updater entra em download
- **THEN** a splash mostra a release alvo e uma barra de progresso percentual

#### Scenario: Fase de applying

- **WHEN** o staging esta sendo preparado
- **THEN** a splash troca a mensagem para a etapa de aplicacao sem reabrir a janela


