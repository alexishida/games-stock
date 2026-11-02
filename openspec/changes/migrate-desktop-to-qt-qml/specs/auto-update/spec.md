<!-- Contrato de distribuição nativa e transição das instalações Electron existentes. -->
# Spec Delta

## RENAMED Requirements
- FROM: `### Requirement: Fonte padrao electron-builder no GitHub`
- TO: `### Requirement: Distribuicao nativa e transicao de instalacoes existentes`

## MODIFIED Requirements

### Requirement: Distribuicao nativa e transicao de instalacoes existentes

O sistema SHALL distribuir artefatos nativos por releases de `alexishida/games-stock`, manter identidade da instalação Windows e oferecer uma ponte compatível com o atualizador Electron existente. O aplicativo final SHALL operar sem runtime Node/Electron instalado.

#### Scenario: Release publicada
- **WHEN** o pipeline de distribuição termina
- **THEN** os pacotes nativos e seus metadados de versão/integridade estão em `release/`, separados dos metadados legados

#### Scenario: Atualização de uma instalação Electron
- **WHEN** uma instalação Electron compatível com a ponte recebe a primeira release nativa
- **THEN** o instalador substitui o aplicativo no mesmo canal, preserva dados e desinstalação e abre a biblioteca existente sem reinstalação manual

#### Scenario: Metadados disponiveis
- **WHEN** o atualizador Electron consulta a release de transição
- **THEN** encontra `latest.yml`, instalador e `.blockmap` compatíveis gerados por tooling validado e pertencentes à mesma build

### Requirement: Atualizacao automatica somente para NSIS Windows

O sistema SHALL verificar, baixar e instalar atualização somente em instalação Windows empacotada por NSIS. Build portátil e plataformas Linux SHALL informar atualização externa.

#### Scenario: Nova versao NSIS
- **WHEN** o manifesto nativo validado descreve versão mais nova que a instalada
- **THEN** o updater baixa o instalador, emite progresso e solicita encerramento controlado para aplicar a instalação

#### Scenario: Build portatil ou Linux
- **WHEN** o usuário busca atualização fora de instalação NSIS Windows
- **THEN** o app informa versão e release disponíveis sem baixar ou executar instalador

### Requirement: Integridade de artefatos

O sistema SHALL validar assinatura do manifesto nativo com chave confiável e hash/tamanho do instalador antes de executá-lo. A ponte Electron SHALL preservar a validação exigida pelo updater legado. Falhas SHALL manter instalação e dados atuais.

#### Scenario: Asset inconsistente
- **WHEN** assinatura, hash, tamanho ou identidade de plataforma não correspondem ao pacote
- **THEN** a instalação é recusada e um erro local é registrado sem substituir a versão atual

#### Scenario: Download interrompido
- **WHEN** a transferência do instalador não termina
- **THEN** o arquivo incompleto não é executado e o aplicativo permanece utilizável


