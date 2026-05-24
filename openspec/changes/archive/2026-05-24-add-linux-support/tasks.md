## 1. Build e distribuição Linux

- [x] 1.1 Substituir scripts shell-specific de `package.json` por comandos cross-platform para dev, build e testes do Electron
- [x] 1.2 Adicionar targets Linux `deb` e `AppImage` no `electron-builder.yml` mantendo a distribuição Windows existente
- [x] 1.3 Ajustar scripts de empacotamento de release para separar artefatos Windows do novo fluxo Linux sem quebrar `release/`

## 2. Paths persistentes e bootstrap

- [x] 2.1 Atualizar `src/main/appPaths.ts` para usar `XDG_DATA_HOME` ou `~/.local/share` como raiz padrão no Linux
- [x] 2.2 Revisar mensagens, helpers e estatísticas que ainda assumem `%APPDATA%` e alinhar com paths por plataforma
- [x] 2.3 Validar que `GAMESTOCK_USER_DATA_DIR` continua sobrescrevendo corretamente o diretório persistente em qualquer SO

## 3. Emuladores e RetroArch no Linux

- [x] 3.1 Criar helper de resolução de executável que aceite path absoluto, relativo e comando via `PATH`
- [x] 3.2 Integrar o helper ao fluxo de `games.launch()` com erros claros para "não encontrado" e "sem permissão de execução"
- [x] 3.3 Atualizar o diálogo de seleção de executável e a UI do formulário para acomodar `.AppImage`, `.sh` e entrada manual de binários sem extensão
- [x] 3.4 Remover a suposição de `.dll` na UI de cores do RetroArch e alinhar labels/inventário com `.so`, `.dll` e `.dylib`

## 4. Updater por plataforma

- [x] 4.1 Restringir download e aplicação automática de update a builds Windows com suporte a update in-place
- [x] 4.2 Ajustar a checagem manual de update para informar em Linux que a atualização é externa ao app
- [x] 4.3 Garantir que packaging e manifesto de update continuem válidos para Windows sem introduzir fluxo incorreto em Linux

## 5. Documentação operacional

- [x] 5.1 Atualizar `README.md` com instalação, desenvolvimento e build para Linux, incluindo Ubuntu-based e `AppImage`
- [x] 5.2 Documentar limitações de update no Linux e troubleshooting básico de runtime nativo
- [x] 5.3 Atualizar a descrição do app e dos dados locais para remover texto Windows-only

## 6. Verificação

- [x] 6.1 Executar smoke de build local (`build:renderer`, `build:main` e empacotamento Linux) após as mudanças
- [x] 6.2 Validar lançamento de emulador com comando via `PATH`, script `.sh`/`AppImage` e erro de permissão em Linux
- [x] 6.3 Validar persistência em diretório XDG e comportamento do updater em build Linux empacotada
