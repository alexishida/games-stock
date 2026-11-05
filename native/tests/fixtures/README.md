<!-- Referências sintéticas preservadas antes da remoção definitiva do backend Electron. -->
# Fixtures de compatibilidade

`legacy-before-migrations.sql` e `legacy-populated.sql` foram exportados do backend Electron
congelado antes de sua remoção. Não contêm dados pessoais. Os IDs 90001+, jogos, variantes,
anotações, histórico, pastas, jobs e inventário preservam o cenário original de compatibilidade.
O executável do emulador de teste é substituído pelo `fake_emulator.exe` nativo ao gerar o perfil.

`python scripts/native-fixtures.py` materializa ambos em um diretório exclusivo sob
`artifacts/native-migration/fixtures-*`, cria imagens/ROMs artificiais e verifica integridade e
foreign keys. Para executar o teste adicional de migrations contra o banco materializado, defina
`GAMESTOCK_TEST_DATABASE` somente para o teste `migrations`. Os testes opcionais de benchmark
usam outra massa, de 5.000 jogos, e não devem receber esta fixture pequena.

`complete.gamestock-backup` permanece como pacote sintético produzido pelo Electron, usado pelos
testes nativos de importação e idempotência. Os pacotes `traversal` e `symlink` verificam rejeições.
Esses arquivos preservam o contrato de dados sem manter um runtime antigo executável.
