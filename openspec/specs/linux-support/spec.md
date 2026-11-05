<!-- Contrato atual consolidado da implementação nativa; histórico preservado em changes/. -->
# linux-support Specification

## Purpose
Definir o suporte oficial do GameStock em Linux com build Qt, execucao desktop e atualizacao externa; a validacao Linux permanece adiada por decisao do usuario.

> Estado atual: os requisitos Linux abaixo são alvos de suporte. Implementação, empacotamento e validação Linux permanecem adiados conforme docs/native-migration/linux-deferred.md; evidências Windows não comprovam esses requisitos.

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

O README SHALL documentar instalação, build CMake/Qt, dependências Linux, limitações de update e diagnóstico ou fallback gráfico validado para o runtime nativo.

#### Scenario: Consulta de Linux no README

- **WHEN** um usuario ou colaborador abre a documentacao
- **THEN** encontra os formatos distribuidos, comandos relevantes e a orientação gráfica válida para Qt, sem recomendar flags exclusivas do Electron como solução nativa
