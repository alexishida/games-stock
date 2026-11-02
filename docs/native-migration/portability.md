<!-- Base técnica da portabilidade; exportação/importação em backup.md. -->
# Portabilidade de dados: ZIP/ZIP64 e manifesto (9.1)

Esta etapa fixa a base binária do formato `.gamestock-backup`. A exportação/importação das cinco
categorias, staging/rollback, UI e compatibilidade cruzada estão em
[backup.md](backup.md) (tarefas 9.2 a 9.5).

## Dependências e build

- libarchive 3.8.11 e zlib 1.3.1 vendorizadas em `native/third_party/`, com origem, SHA-256 e
  licenças em `native/third_party/README.md`.
- O build habilita somente ZIP/ZIP64 + DEFLATE. OpenSSL, LZMA, Zstd, bzip2, XML, iconv, ACL/xattr e
  as ferramentas de linha de comando ficam desligados.
- `LIBARCHIVE_STATIC` é definido no alvo `gamestock_core`; nenhuma DLL adicional é necessária.
- `native/src/portability/ZipArchive.h` evita expor `archive.h` ao restante do código.

## API implementada

| Classe/função | Contrato |
|---|---|
| `ZipWriter::open(path, forceZip64, compression)` | Cria ZIP com compressão global `Store` ou `Deflate`; `forceZip64` grava EOCD64/localizador mesmo em pacotes pequenos. |
| `ZipWriter::addData/addFile` | Grava JSON em memória ou mídia em streaming (blocos de 1 MiB), sem carregar o arquivo inteiro. |
| `ZipWriter::finish` | Finaliza o diretório central; erro mantém o diagnóstico do arquivo/entrada. |
| `ZipReader::open` | Lê o diretório central com seek e expõe `path`, `size` (inclusive ZIP64) sem descomprimir tudo. |
| `ZipReader::readEntry` | Lê JSON/dados com limite explícito de bytes; recusa tamanho anunciado acima do limite. |
| `ZipReader::extractEntry` | Extrai com limite, `QSaveFile` e validação de caminho (`..`, absoluto, unidade Windows). |
| `PortableManifest` | Serializa/lê `schemaVersion`, `appVersion`, `createdAt`, `categories` e `counts`; versão diferente de 1 é recusada sem alterar dados. |

Limites usados nesta etapa: 64 MiB para JSON de manifesto/dados e limites explícitos por chamada
para mídia. O manifesto aceita somente as cinco categorias atuais e exige ao menos uma.

## Verificação executada (Windows, 02/11/2026)

```powershell
ctest --test-dir native/build/windows-msvc -C Release -R portable-archive --output-on-failure
$env:GAMESTOCK_ZIP64_LARGE_TEST = "1"
native/build/windows-msvc/Release/portable_archive_tests.exe largeZip64RoundTrip
```

- `portable-archive`: STORED e DEFLATED, round-trip de JSON e binário, extração, limites de leitura,
  recusa de `../`, ZIP64 forçado (assinaturas `PK\x06\x06`/`PK\x06\x07`) e manifesto schemaVersion 1.
- Pacote real > 4 GiB: arquivo de 4.294.968.320 bytes gravado e extraído com sucesso em ~21 s,
  usando ZIP64 automático.
- Compatibilidade de leitura: `GAMESTOCK_BACKUP_FIXTURE=artifacts/native-migration/fixtures-H6UzzV/complete.gamestock-backup`
  lê `manifest.json` schemaVersion 1 gerado pelo Electron.
- A escrita Qt → Electron será comprovada na tarefa 9.2 com importação real; a estrutura é ZIP
  padrão com diretório central e descritores de dados.

## Limitações e próximos passos

- O escritor de backup usa `CompatibleZipWriter` (STORED com cabeçalhos locais completos), aceito
  pelo leitor do Electron; `ZipWriter`/libarchive segue disponível para DEFLATE e testes de ZIP64.
- A exportação das cinco categorias, o preview com conflitos e a importação com staging estão em
  `backup.md`.
- O teste >4 GiB é opt-in para não pesar no CI; o teste padrão cobre ZIP64 forçado.
