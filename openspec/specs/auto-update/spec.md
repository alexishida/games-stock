<!-- Contrato atual consolidado da implementação nativa; histórico preservado em changes/. -->
# auto-update Specification

## Purpose

Atualizar instalacoes Windows via manifesto assinado publicado em GitHub Releases, com splash, timeout/offline e atualizacao externa para portatil e Linux.

## Requirements

### Requirement: Distribuicao nativa e transicao de instalacoes existentes

O sistema SHALL distribuir instalador NSIS e pacote portátil Windows nativos por releases de `alexishida/games-stock`, sem dependência de runtime Node/Electron. O Qt é distribuído como instalação nova; ponte electron-updater, latest.yml e blockmap não são requisitos da distribuição atual. Atualizações SHALL preservar o perfil existente.

#### Scenario: Pacotes locais
- **WHEN** o mantenedor gera os pacotes Windows
- **THEN** instalador e portátil ficam em release/ sem publicação automática

#### Scenario: Manifesto disponível
- **WHEN** a instalação NSIS consulta o feed
- **THEN** o updater nativo lê latest.json assinado e valida versão, assinatura e integridade antes de executar o instalador

#### Scenario: Continuidade dos dados
- **WHEN** uma versão nativa é instalada sobre uma instalação existente
- **THEN** o banco, mídias e preferências do perfil são preservados

### Requirement: Atualizacao automatica somente para NSIS Windows

O sistema SHALL verificar, baixar e instalar atualização somente em instalação Windows empacotada por NSIS. Build portátil e plataformas Linux SHALL informar atualização externa.

#### Scenario: Nova versao NSIS
- **WHEN** o manifesto nativo validado descreve versão mais nova que a instalada
- **THEN** o updater baixa o instalador, emite progresso e solicita encerramento controlado para aplicar a instalação

#### Scenario: Build portatil ou Linux
- **WHEN** o usuário busca atualização fora de instalação NSIS Windows
- **THEN** o app informa versão e release disponíveis sem baixar ou executar instalador

### Requirement: Integridade de artefatos

O sistema SHALL validar assinatura do manifesto nativo com chave confiável e hash/tamanho do instalador antes de executá-lo. Falhas SHALL manter instalação e dados atuais.

#### Scenario: Asset inconsistente
- **WHEN** assinatura, hash, tamanho ou identidade de plataforma não correspondem ao pacote
- **THEN** a instalação é recusada e um erro local é registrado sem substituir a versão atual

#### Scenario: Download interrompido
- **WHEN** a transferência do instalador não termina
- **THEN** o arquivo incompleto não é executado e o aplicativo permanece utilizável

### Requirement: Disponibilidade do aplicativo

O sistema SHALL limitar verificacao automatica da splash a 30 segundos. Erros de rede SHALL liberar abertura do app apos usuario escolher continuar.

#### Scenario: Sem conexao

- **WHEN** consulta de update falha por rede
- **THEN** splash exibe estado offline e permite continuar sem atualizar
