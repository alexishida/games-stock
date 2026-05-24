## ADDED Requirements

### Requirement: Artefatos oficiais de distribuição Linux

O sistema SHALL gerar artefatos Linux `x86_64` em `release/` nos formatos `.deb` e `AppImage`, usando a mesma versão do aplicativo definida em `package.json`.

#### Scenario: Build Linux concluída

- **WHEN** o mantenedor executa o pipeline de distribuição Linux
- **THEN** o diretório `release/` contém um pacote `.deb` para distribuições Debian/Ubuntu-based e um `AppImage` para desktop Linux genérico, ambos com a mesma versão do app

#### Scenario: Instalação em distro Ubuntu-based

- **WHEN** o usuário instala o pacote `.deb` em uma distribuição Ubuntu-based suportada
- **THEN** o GameStock inicia sem depender de variáveis de ambiente, comandos ou artefatos exclusivos de Windows

### Requirement: Documentação operacional Linux

O sistema SHALL documentar no README os pré-requisitos, comandos de desenvolvimento/build, formatos distribuídos e limitações de atualização para Linux.

#### Scenario: Consulta de instalação Linux

- **WHEN** o usuário abre a seção de instalação do README
- **THEN** encontra instruções para executar o app em Linux, incluindo formatos disponíveis, dependências esperadas e orientação para atualizar builds Linux fora do app

#### Scenario: Consulta de desenvolvimento Linux

- **WHEN** um colaborador abre a seção de desenvolvimento do README
- **THEN** encontra comandos compatíveis com Linux para instalar dependências, iniciar ambiente de desenvolvimento e gerar build local
