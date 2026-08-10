# linux-support Specification

## Purpose
Definir o suporte oficial do GameStock em Linux, incluindo build distribuivel, execucao desktop e limitacoes conhecidas de atualizacao.

## Requirements
### Requirement: Artefatos oficiais Linux

O sistema SHALL gerar artefatos Linux `x64` em `release/` nos formatos `.deb` e `AppImage`.

#### Scenario: Build Linux concluida

- **WHEN** o pipeline de distribuicao Linux e executado
- **THEN** `release/` contem pelo menos um `.deb` e um `AppImage` da mesma versao do app

### Requirement: Execucao funcional em Linux

O app SHALL inicializar em Linux sem depender de componentes exclusivos de Windows para a operacao normal.

#### Scenario: Rodar build Linux

- **WHEN** o usuario abre o build Linux instalado
- **THEN** a janela principal funciona normalmente, mesmo sem suporte a self-update in-place

### Requirement: Atualizacao externa em Linux

Builds Linux SHALL usar atualizacao externa ao app.

#### Scenario: Buscar atualizacao manual

- **WHEN** o usuario consulta updates pela tela Sobre
- **THEN** o app informa a release disponivel, mas nao baixa nem aplica pacote automaticamente

### Requirement: Documentacao operacional

O README SHALL documentar instalacao, build, limitacoes de update e o workaround opcional de GPU para Linux.

#### Scenario: Consulta de Linux no README

- **WHEN** um usuario ou colaborador abre a documentacao
- **THEN** encontra os formatos distribuidos, comandos relevantes e a orientacao sobre `GAMESTOCK_DISABLE_GPU` quando necessario
