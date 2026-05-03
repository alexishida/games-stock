## ADDED Requirements

### Requirement: Exibição de emulador padrão na lista de plataformas
O sistema SHALL exibir na lista de plataformas do SettingsModal o nome do emulador padrão de cada plataforma (se configurado).

#### Scenario: Plataforma com emulador padrão
- **WHEN** a lista de plataformas é exibida e uma plataforma tem emulador padrão configurado
- **THEN** o nome do emulador padrão aparece ao lado ou abaixo do nome da plataforma

#### Scenario: Plataforma sem emulador padrão
- **WHEN** a lista de plataformas é exibida e uma plataforma não tem emulador padrão
- **THEN** exibe indicação visual de que nenhum emulador está configurado (ex: "—" ou "Nenhum")
