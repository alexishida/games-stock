# auto-update Specification

## Purpose

Atualizar instalacoes NSIS Windows usando artefatos padrao do electron-builder publicados em GitHub Releases.

## Requirements

### Requirement: Fonte padrao electron-builder no GitHub

O sistema SHALL usar `electron-updater` com provider GitHub configurado para `alexishida/games-stock`. O build Windows SHALL gerar `app-update.yml`, `latest.yml`, instalador NSIS e arquivo `.blockmap` sem empacotamento customizado de ZIP.

#### Scenario: Release publicada

- **WHEN** mantenedor executa `npm run dist:windows`
- **THEN** arquivos padrao do electron-builder sao escritos em `release/` e podem ser enviados sem renomear para GitHub Release publica

#### Scenario: Metadados disponiveis

- **WHEN** instalacao NSIS verifica atualizacao
- **THEN** electron-updater le `latest.yml` da ultima GitHub Release e usa instalador correspondente

### Requirement: Atualizacao automatica somente para NSIS Windows

O sistema SHALL verificar, baixar e instalar atualizacao somente em instalacao Windows empacotada por NSIS. Build portatil e plataformas Linux SHALL informar atualizacao externa.

#### Scenario: Nova versao NSIS

- **WHEN** `latest.yml` descreve versao mais nova que a instalada
- **THEN** updater baixa instalador, emite progresso, encerra app e executa instalacao padrao

#### Scenario: Build portatil ou Linux

- **WHEN** usuario busca atualizacao fora de instalacao NSIS Windows
- **THEN** app nao baixa nem executa instalador e informa distribuicao manual pela release

### Requirement: Integridade de artefatos

O sistema SHALL confiar em SHA-512 e blockmaps contidos nos metadados gerados pelo electron-builder. `latest.yml`, instalador e `.blockmap` SHALL pertencer a mesma build.

#### Scenario: Asset inconsistente

- **WHEN** checksum ou metadados de release nao correspondem ao instalador
- **THEN** electron-updater falha sem substituir instalacao atual e app registra erro local

### Requirement: Disponibilidade do aplicativo

O sistema SHALL limitar verificacao automatica da splash a 30 segundos. Erros de rede SHALL liberar abertura do app apos usuario escolher continuar.

#### Scenario: Sem conexao

- **WHEN** consulta de update falha por rede
- **THEN** splash exibe estado offline e permite continuar sem atualizar
