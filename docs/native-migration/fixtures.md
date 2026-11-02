<!-- Procedimento reproduzível para gerar somente dados sintéticos de migração. -->
# Fixtures de migração

Executar `node scripts/native-fixtures.cjs` na raiz com as dependências já instaladas. O comando compila o main diretamente com TypeScript, sem executar o gerador de build-meta, e usa Electron em modo Node para respeitar o ABI de better-sqlite3. O emulador falso roda com o Node do terminal.

Cada execução cria uma pasta exclusiva `artifacts/native-migration/fixtures-<sufixo>/`, ignorada pelo Git. Não há consulta a APPDATA, cópia de dados reais, download de metadados ou limpeza recursiva de artefatos antigos.

Os artefatos incluem:

- `legacy-before-migrations.db`: banco fechado de geração anterior, sem library_group_key nem is_default na plataforma.
- `legacy-populated/`: perfil migrado com jogos, variantes de mesmo título, mídia PNG própria, caminhos com espaços/acentos, inventário com foto, item multiplataforma, configuração de pastas antiga e jobs running.
- `fake-emulator.cjs` dentro do perfil: registra argumentos em emulator-invocation.json e encerra sem executar uma ROM.
- Seis pacotes `.gamestock-backup`: um por categoria e um completo, todos produzidos pelo exportador real.
- Perfis `restored-*`: restauração pelo importador real em diretórios exclusivos.
- `verification.json`: versões efetivas, snapshot estável, verificações executadas e observações sobre perdas na referência.

O gerador verifica notas/contagem legadas após migrations, reabertura idempotente, integrity_check, foreign_key_check, argumentos do emulador falso, preview sem erro, restauração básica e caminhos/fotos presentes no destino. Ele não certifica ZIP64 maior que 4 GiB, equivalência Qt ou paridade visual; essas verificações têm tarefas próprias.

Na primeira execução verificada, o Electron atual mostrou duas limitações que ficam registradas no JSON: o pacote metadata não contém launch_count e a restauração de variantes de mesmo título sem caminhos pode reaproveitar o mesmo placeholder. Portanto, os seis roundtrips básicos não significam preservação integral dessas informações. Antes do corte, a etapa de portabilidade deve resolver/documentar a compatibilidade desses casos sem perda silenciosa. A leitura direta do SQLite preserva os registros e o histórico, que continuam sendo a fonte da verdade.
